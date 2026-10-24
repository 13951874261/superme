const fs = require('fs');
const ts = require('typescript');

const fileName = 'src/components/modules/english/tabs/DashboardTab.tsx';
const sourceText = fs.readFileSync(fileName, 'utf8');

const sourceFile = ts.createSourceFile(
  fileName,
  sourceText,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX
);

function inspectConditionalBlock(node) {
  let kindName = ts.SyntaxKind[node.kind];
  let lineAndChar = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  let line = lineAndChar.line + 1;

  if (line === 1335 && node.kind === ts.SyntaxKind.JsxExpressionContainer) {
    console.log(`Found conditional block at line 1335:`);
    console.log(node.getText(sourceFile).substring(0, 300) + '...');
    
    // Let's traverse children of this node to see what is inside
    console.log('Children inside the block:');
    function printChildren(n, indent = '  ') {
      let l = sourceFile.getLineAndCharacterOfPosition(n.getStart(sourceFile)).line + 1;
      let k = ts.SyntaxKind[n.kind];
      let txt = n.getText(sourceFile).substring(0, 50).replace(/\n/g, ' ');
      console.log(`${indent}- ${k} at line ${l} (${txt})`);
      ts.forEachChild(n, c => printChildren(c, indent + '  '));
    }
    printChildren(node);
  }

  ts.forEachChild(node, inspectConditionalBlock);
}

inspectConditionalBlock(sourceFile);
