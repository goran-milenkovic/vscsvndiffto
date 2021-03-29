import * as vscode from 'vscode';
import * as path from 'path';

export class SVNDiffToProvider implements vscode.TreeDataProvider<SVNDiffToItem> {
    constructor(private filesDiff: any) {}

    getTreeItem(element: SVNDiffToItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: SVNDiffToItem): Thenable<SVNDiffToItem[]> {
        if (element) {
            return Promise.resolve([]);
        } else {
            var resolveResult: SVNDiffToItem[] = [];
            this.filesDiff.forEach((element: any) => {
                if(element.path === 'Choose file')
                {
                    return false;
                }
                const svnDiffToItem = new SVNDiffToItem(
                    element.path.replace(/^.*[\\\/]/, ''),
                    element.path,
                    element.type, 
                    element.leftFile, 
                    element.rightFile, 
                    vscode.TreeItemCollapsibleState.None
                );
                resolveResult.push(svnDiffToItem);
            });
            return Promise.resolve(resolveResult);
        }
    }
}

class SVNDiffToItem extends vscode.TreeItem {
    constructor(
      public readonly label: string,
      private diffPath: string,
      private type: string,
      private leftFileUri: vscode.Uri,
      private rightFileUri: vscode.Uri,
      public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(label, collapsibleState);

        if(type !== null && leftFileUri !== null && rightFileUri !== null)
        {
            this.description = `${this.type} - ${this.diffPath}`;
            this.tooltip = `${this.diffPath}`;
            this.command = {
                "title": "SVN DiffTo",
                "command": "vscode.diff",
                "arguments": [
                    leftFileUri,
                    rightFileUri,
                    "SVN DiffTO: " + label
                ]
            };

            let iconName = 'invalid.png';
            if(type === 'M')
            {
                iconName = 'dot_blue.png';
            }
            else if(type === 'A')
            {
                iconName = 'dot_green.png';
            }
            else if(type === 'D')
            {
                iconName = 'dot_grey.png';
            }
            this.iconPath = {
                light: path.join(__filename, '..', '..', 'resources', iconName),
                dark: path.join(__filename, '..', '..', 'resources', iconName)
            };
        }
    }
  }
  