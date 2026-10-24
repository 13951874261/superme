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

function printAncestors(node, depth = 0) {
  let kindName = ts.SyntaxKind[node.kind];
  let lineAndChar = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  let line = lineAndChar.line + 1;

  if (node.kind === ts.SyntaxKind.JsxSelfClosingElement || node.kind === ts.SyntaxKind.JsxOpeningElement) {
    const tagName = node.tagName.getText(sourceFile);
    if (tagName === 'CustomThemeModal') {
      console.log(`Found CustomThemeModal at line ${line}`);
      console.log('Ancestor chain:');
      let current = node;
      while (current) {
        let curLine = sourceFile.getLineAndCharacterOfPosition(current.getStart(sourceFile)).line + 1;
        let curKind = ts.SyntaxKind[current.kind];
        let extraInfo = '';
        if (current.kind === ts.SyntaxKind.JsxExpressionContainer) {
          extraInfo = ` (expr: ${current.getText(sourceFile).substring(0, 60)}...)`;
        } else if (current.kind === ts.SyntaxKind.BinaryExpression) {
          extraInfo = ` (bin: ${current.getText(sourceFile).substring(0, 60)}...)`;
        }
        console.log(`  - ${curKind} at line ${curLine}${extraInfo}`);
        current = current.parent;
      }
    }
  }

  ts.forEachChild(node, (child) => {
    // Set parent pointer since ts.forEachChild doesn't set it by default
    child.parent = node;
    printAncestors(child, depth + 1);
  });
}

printAncestors(sourceFile);
