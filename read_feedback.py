# -*- coding: utf-8 -*-
import zipfile
import xml.etree.ElementTree as ET

def get_docx_text(path):
    try:
        import docx
        doc = docx.Document(path)
        return "\n".join([p.text for p in doc.paragraphs])
    except ImportError:
        try:
            with zipfile.ZipFile(path) as z:
                xml_content = z.read("word/document.xml")
            root = ET.fromstring(xml_content)
            namespaces = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
            texts = []
            for paragraph in root.iter("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p"):
                p_text = "".join([node.text for node in paragraph.iter("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t") if node.text])
                texts.append(p_text)
            return "\n".join(texts)
        except Exception as e:
            return f"Error reading {path}: {e}"

print("=== 7.21 ===")
print(get_docx_text(r"D:\HuaweiMoveData\Users\lzhumy\Desktop\7.21日反馈 (已自动恢复).docx")[:3000])
print("\n=== 7.22 ===")
print(get_docx_text(r"D:\HuaweiMoveData\Users\lzhumy\Desktop\7.22日反馈.docx")[:3000])
