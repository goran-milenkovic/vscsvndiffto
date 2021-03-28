import * as vscode from 'vscode';

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
                const svnDiffToItem = new SVNDiffToItem(element.type + ' - ' + element.path, element.type, element.leftFile, element.rightFile, vscode.TreeItemCollapsibleState.None);
                resolveResult.push(svnDiffToItem);
            });
            return Promise.resolve(resolveResult);
        }
    }
}

class SVNDiffToItem extends vscode.TreeItem {
    constructor(
      public readonly label: string,
      private type: string,
      private leftFileUri: vscode.Uri,
      private rightFileUri: vscode.Uri,
      public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(label, collapsibleState);
        this.tooltip = `${this.label}`;
        this.description = this.label;
        this.command = {
            "title": "SVN DiffTo",
            "command": "vscode.diff",
            "arguments": [
                leftFileUri, 
                rightFileUri,
                "SVN DiffTO: " + label
            ]
        };
    }
  
    // iconPath = {
    //   light: path.join(__filename, '..', '..', 'resources', 'light', 'dependency.svg'),
    //   dark: path.join(__filename, '..', '..', 'resources', 'dark', 'dependency.svg')
    // };
  }
  