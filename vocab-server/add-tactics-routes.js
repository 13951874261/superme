const fs = require('fs');
const path = 'D:/cursor/work/super-agent/vocab-server/server.js';
let content = fs.readFileSync(path, 'utf8');

// Find the location to insert new routes (after the prototypes delete route)
const anchorStr = "app.delete('/api/game-theory/prototypes/:id', (req, res) => {\r\n  try {\r\n    db.prepare('DELETE FROM personal_prototypes WHERE id = ?').run(req.params.id);\r\n    res.json({ success: true });\r\n  } catch (error) {\r\n    console.error(error);\r\n    res.status(500).json({ error: 'Database error' });\r\n  }\r\n});";

const newRoutes = `

// ==========================================
// 博弈论驭人术手段管理接口
// ==========================================

// 获取所有驭人术手段（系统默认 + 用户自定义）
app.get('/api/game-theory/tactics', (req, res) => {
  try {
    const userId = req.query.userId || 'default-user';
    const rows = db.prepare(\`
      SELECT * FROM game_theory_tactics 
      WHERE user_id = ? OR user_id = 'system'
      ORDER BY created_at DESC
    \`).all(userId);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});

// 手动添加或更新驭人术手段
app.post('/api/game-theory/tactics', (req, res) => {
  try {
    const { userId, id, name, category, description, isCustom } = req.body;
    if (!userId || !name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const now = Date.now();
    
    if (id) {
      // 更新现有手段
      db.prepare(\`
        UPDATE game_theory_tactics 
        SET name = ?, category = ?, description = ?, is_custom = ?, source_file = ?, created_at = ?
        WHERE id = ? AND user_id = ?
      \`).run(name, category, description, isCustom ? 1 : 0, req.body.sourceFile || null, now, id, userId);
      res.json({ success: true, id, status: 'updated' });
    } else {
      // 添加新手段
      const newId = crypto.randomUUID();
      db.prepare(\`
        INSERT INTO game_theory_tactics (id, user_id, name, category, description, is_custom, source_file, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      \`).run(newId, userId, name, category, description, isCustom ? 1 : 0, req.body.sourceFile || null, now);
      res.json({ success: true, id: newId, status: 'created' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});

// 删除驭人术手段
app.delete('/api/game-theory/tactics/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM game_theory_tactics WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Tactic not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});

// 上传书籍材料并提取驭人术知识点
app.post('/api/game-theory/upload-tactics-material', upload.any(), async (req, res) => {
  try {
    const userId = req.body.userId || 'default-user';
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    // 读取文件内容
    const buffer = fs.readFileSync(file.path);
    const fileName = file.originalname || 'uploaded_material';
    
    // 提取文本内容
    let textContent = '';
    const isPdf = fileName.toLowerCase().endsWith('.pdf');
    const isText = /\.(txt|md)$/i.test(fileName);
    
    if (isText) {
      textContent = buffer.toString('utf-8');
    } else if (isPdf) {
      try {
        const pdfParse = require('pdf-parse');
        const pdfData = await pdfParse(buffer);
        textContent = pdfData.text;
      } catch (e) {
        console.error('PDF parse error:', e.message);
        textContent = '';
      }
    }
    
    if (!textContent || textContent.length < 100) {
      fs.unlinkSync(file.path);
      return res.status(400).json({ error: 'Could not extract text from file' });
    }
    
    // 使用 Dify 工作流提取知识点
    try {
      const BASE_URL = process.env.DIFY_BASE_URL || 'https://udify.org';
      const DATASET_KEY = process.env.DATASET_KEY || '';
      
      // 上传到 Dify 知识库
      const formData = new FormData();
      const blob = new Blob([buffer], { type: 'application/octet-stream' });
      formData.append('file', blob, fileName);
      formData.append('indexing_technique', 'high_quality');
      formData.append('processing_rule', JSON.stringify({
        mode: 'custom',
        rules: {
          pre_processing_rules: [{ id: 'remove_extra_spaces', enabled: true }],
          indexing_mode: 'high_quality'
        }
      }));
      
      const uploadResponse = await fetch(\`\${BASE_URL}/v1/datasets/upload_document\`, {
        method: 'POST',
        headers: { 'Authorization': \`Bearer \${DATASET_KEY}\` },
        body: formData
      });
      
      if (uploadResponse.ok) {
        const uploadData = await uploadResponse.json();
        const documentId = uploadData.document?.id;
        
        // 查询文档处理状态
        let status = 'processing';
        for (let i = 0; i < 30; i++) {
          await new Promise(r => setTimeout(r, 2000));
          const statusRes = await fetch(\`\${BASE_URL}/v1/datasets/\${documentId}/documents\`, {
            headers: { 'Authorization': \`Bearer \${DATASET_KEY}\` }
          });
          if (statusRes.ok) {
            const data = await statusRes.json();
            status = data.data?.[0]?.indexing_status || 'processing';
            if (status === 'completed' || status === 'error') break;
          }
        }
        
        // 使用 Dify 提取知识点
        const extractResponse = await fetch(\`\${BASE_URL}/v1/workflows/run\`, {
          method: 'POST',
          headers: { 
            'Authorization': \`Bearer \${DATASET_KEY}\`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            inputs: { material_content: textContent },
            response_mode: 'blocking',
            user: userId
          })
        });
        
        if (extractResponse.ok) {
          const extractData = await extractResponse.json();
          const extractedTactics = extractData.data?.outputs?.tactics || [];
          
          // 保存提取的知识点到数据库
          const insert = db.prepare(\`
            INSERT INTO game_theory_tactics (id, user_id, name, category, description, is_custom, source_file, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          \`);
          
          const savedIds = [];
          for (const tactic of extractedTactics) {
            const id = crypto.randomUUID();
            insert.run(id, userId, tactic.name, tactic.category || 'downward', tactic.description, 1, fileName, Date.now());
            savedIds.push(id);
          }
          
          res.json({ success: true, tacticIds: savedIds, count: savedIds.length });
        } else {
          throw new Error('Dify extraction failed');
        }
        
        // 清理临时文件
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      } else {
        throw new Error('Dify upload failed');
      }
    } catch (difyError) {
      console.error('Dify workflow error:', difyError.message);
      // 回退到本地提取（简单版本）
      const localTactics = extractTacticsLocally(textContent, fileName);
      if (localTactics.length > 0) {
        const insert = db.prepare(\`
          INSERT INTO game_theory_tactics (id, user_id, name, category, description, is_custom, source_file, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        \`);
        
        const savedIds = [];
        for (const tactic of localTactics) {
          const id = crypto.randomUUID();
          insert.run(id, userId, tactic.name, tactic.category, tactic.description, 1, fileName, Date.now());
          savedIds.push(id);
        }
        res.json({ success: true, tacticIds: savedIds, count: savedIds.length, method: 'local' });
      } else {
        res.status(500).json({ error: 'Failed to extract tactics from material' });
      }
    }
  } catch (error) {
    console.error('[Upload Tactics Material] Error:', error);
    res.status(500).json({ error: error.message || 'Upload failed' });
  }
});

// 本地简单提取兜底函数
function extractTacticsLocally(text, fileName) {
  // 简单提取：匹配常见的驭人术关键词
  const patterns = [
    /(\w+)?(捧杀|架空|借刀杀人|隔山打牛|恩威并施|制衡|分而治之|边缘化|信息垄断|软对抗|借势|联盟)/gi,
    /(\w+)?(控制|管理|领导|权术|驾驭|操控)/gi
  ];
  
  const tactics = [];
  const seen = new Set();
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const tactic = match[1] ? match[1] + match[2] : match[2];
      if (!seen.has(tactic) && tactic.length > 2) {
        seen.add(tactic);
        tactics.push({
          name: tactic,
          category: 'downward',
          description: \`基于材料 \${fileName} 自动提取的手段的\${tactic}。\`
        });
      }
    }
  }
  
  return tactics.slice(0, 10); // 最多返回10个
}
`;

  // Find the end of prototypes delete route
  const insertPos = content.indexOf('\r\n\r\n// ??? 404\r\n', idx + anchorStr.length);
  
  if (insertPos > 0) {
    content = content.substring(0, insertPos) + newRoutes + content.substring(insertPos);
    fs.writeFileSync(path, content, 'utf8');
    console.log('Successfully added game-theory/tactics routes.');
  } else {
    console.log('Could not find insertion point.');
  }
}
