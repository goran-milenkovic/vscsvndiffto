"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require("vscode");
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
function activate(context) {
    // The command has been defined in the package.json file
    // Now provide the implementation of the command with registerCommand
    // The commandId parameter must match the command field in package.json
    let disposable = vscode.commands.registerCommand('svndiffto.svndiffto', () => {
        let workspaceFolders = vscode.workspace.workspaceFolders;
        if (typeof workspaceFolders === 'undefined') {
            workspaceFolders = [];
        }
        if (workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('No workspace folders');
            return;
        }
        const workspaceFoldersConst = workspaceFolders;
        const workspaceFolderNames = workspaceFolders.map(folder => folder.name);
        const quickPickOptions = workspaceFolderNames.map(label => ({ label }));
        const quickPick = vscode.window.createQuickPick();
        quickPick.items = quickPickOptions;
        quickPick.onDidChangeSelection(([{ label }]) => {
            quickPick.hide();
            const pickedProject = label;
            let index = -1;
            for (var i = 0; i < quickPickOptions.length; i += 1) {
                if (quickPickOptions[i]['label'] === pickedProject) {
                    index = i;
                    break;
                }
            }
            const workspaceFolderPath = workspaceFoldersConst[index].uri.path;
            let generatingStatusMessage = vscode.window.setStatusBarMessage('fetching svn info');
            const cp1 = require('child_process');
            cp1.exec('svn info ' + workspaceFolderPath, (err, stdout, stderr) => {
                if (err) {
                    console.log('error: ' + err);
                    vscode.window.showErrorMessage('error: ' + err);
                    return;
                }
                generatingStatusMessage.dispose();
                generatingStatusMessage = vscode.window.setStatusBarMessage('parsing fetched svn info');
                let projectSvnInfoLines = stdout.match(/[^\r\n]+/g);
                if (projectSvnInfoLines === null) {
                    vscode.window.showErrorMessage('svn info empty');
                    return;
                }
                const relativeUrlLine = projectSvnInfoLines[3];
                const repositoryRootLine = projectSvnInfoLines[4];
                const projectRelativeUrl = relativeUrlLine.substring(14);
                const projectRepositoryRoot = repositoryRootLine.substring(17);
                const projectRelativeUrlClean = projectRelativeUrl.replace(/^(\^\/)/, "");
                generatingStatusMessage.dispose();
                let svntagOptions = {
                    prompt: "Choose with what to diff: ",
                    placeHolder: "^/trunk"
                };
                generatingStatusMessage.dispose();
                vscode.window.showInputBox(svntagOptions).then(value => {
                    let answer = value;
                    if (!answer || typeof answer === 'undefined') {
                        answer = '^/trunk';
                    }
                    const finalAnswer = answer;
                    const answerClean = finalAnswer.replace(/^(\^\/)/, "");
                    const svnOld = projectRepositoryRoot + '/' + answerClean;
                    const svnNew = projectRepositoryRoot + '/' + projectRelativeUrlClean;
                    generatingStatusMessage = vscode.window.setStatusBarMessage('Generating DiffTo - fetching from server...');
                    const cp2 = require('child_process');
                    cp2.exec('svn diff --old=' + svnOld + ' --new=' + svnNew, { maxBuffer: 1024 * 1024 * 1024 }, (err, stdout, stderr) => {
                        if (err) {
                            console.log('error: ' + err);
                            vscode.window.showErrorMessage('error: ' + err);
                            return;
                        }
                        generatingStatusMessage.dispose();
                        let parsingStatusMessage = vscode.window.setStatusBarMessage('Generating DiffTo - parsing');
                        const svndiffContentArray = stdout.split('Index: ');
                        let filesDiff = [{
                                'path': 'Choose file',
                            }];
                        svndiffContentArray.forEach(element => {
                            if (element.trim().length === 0) {
                                return;
                            }
                            const elementLines = element.split("\n");
                            const path = elementLines[0];
                            var elementAddLines = 0;
                            var elementDeleteLines = 0;
                            elementLines.forEach((elementLine) => {
                                if (elementLine.startsWith("-")) {
                                    elementDeleteLines++;
                                }
                                else if (elementLine.startsWith("+")) {
                                    elementAddLines++;
                                }
                            });
                            var elemetType = 'm';
                            if (elementDeleteLines === 1) {
                                elemetType = 'a';
                            }
                            else if (elementAddLines === 1) {
                                elemetType = 'd';
                            }
                            filesDiff.push({
                                'path': path,
                                'diffContent': element,
                                'type': elemetType
                            });
                        });
                        parsingStatusMessage.dispose();
                        vscode.window.setStatusBarMessage('Generating DiffTo done', 2000);
                        //vscode.window.createTreeView('svnDiffTo', {
                        //	treeDataProvider: new SVNDiffToProvider()
                        //  });
                        //new FileExplorer(context);
                        const column = vscode.window.activeTextEditor
                            ? vscode.window.activeTextEditor.viewColumn
                            : undefined;
                        const panel = vscode.window.createWebviewPanel('svndiffto', "SVN DiffTO: " + pickedProject + ' <-> ' + finalAnswer, column || vscode.ViewColumn.One, {
                            // Enable scripts in the webview
                            enableScripts: true
                        });
                        let difItemsSelectContent = '';
                        filesDiff.forEach((element, index) => {
                            difItemsSelectContent += '<option value=' + index + '>' +
                                element.type + ' - ' + element.path
                                + '</option>';
                        });
                        const cssUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'src', 'css', 'styles.css'));
                        panel.webview.html = getWebviewContent(difItemsSelectContent, cssUri);
                        // Handle messages from the webview
                        panel.webview.onDidReceiveMessage(message => {
                            switch (message.command) {
                                case 'onSelectChange':
                                    const filesDiffType = filesDiff[message.files_diff_index].type;
                                    const filesDiffPath = filesDiff[message.files_diff_index].path;
                                    if (filesDiffType === 'a') {
                                        const filePath = workspaceFolderPath + '/' + filesDiff[message.files_diff_index].path;
                                        var openPath = vscode.Uri.parse("file://" + filePath); //A request file path
                                        vscode.workspace.fs.stat(openPath).then(fStat => {
                                            vscode.workspace.fs.readFile(openPath).then(content => {
                                                if (typeof filesDiff[message.files_diff_index].tempPath === 'undefined') {
                                                    const cpTemp1 = require('child_process');
                                                    cpTemp1.exec('mktemp', (err, stdout, stderr) => {
                                                        if (err) {
                                                            console.log('error: ' + err);
                                                            vscode.window.showErrorMessage('error: ' + err);
                                                            return;
                                                        }
                                                        const emptyTempFilePath = stdout.trim();
                                                        var emptyTempPathUri = vscode.Uri.parse("file://" + emptyTempFilePath);
                                                        filesDiff[message.files_diff_index].tempPath = emptyTempPathUri;
                                                        vscode.commands.executeCommand('vscode.diff', emptyTempPathUri, openPath, "SVN DiffTO: " + filesDiffPath, {
                                                            preserveFocus: true,
                                                            viewColumn: vscode.ViewColumn.Beside
                                                        });
                                                    });
                                                }
                                                else {
                                                    var emptyTempPathUri = filesDiff[message.files_diff_index].tempPath;
                                                    vscode.commands.executeCommand('vscode.diff', emptyTempPathUri, openPath, "SVN DiffTO: " + filesDiffPath, {
                                                        preserveFocus: true,
                                                        viewColumn: vscode.ViewColumn.Beside
                                                    });
                                                }
                                            });
                                        });
                                    }
                                    else {
                                        if (typeof filesDiff[message.files_diff_index].tempPath1 === 'undefined') {
                                            const cpTemp1 = require('child_process');
                                            cpTemp1.exec('mktemp', (err, stdout, stderr) => {
                                                if (err) {
                                                    console.log('error: ' + err);
                                                    vscode.window.showErrorMessage('error: ' + err);
                                                    return;
                                                }
                                                const tempFilePath = stdout.trim();
                                                var tempPathUri = vscode.Uri.parse("file://" + tempFilePath);
                                                const svnPath = svnOld + '/' + filesDiff[message.files_diff_index].path;
                                                const cp3 = require('child_process');
                                                cp3.exec('svn cat ' + svnPath + ' > ' + tempFilePath, { maxBuffer: 1024 * 1024 * 1024 }, (err, stdout, stderr) => {
                                                    if (err) {
                                                        console.log('error: ' + err);
                                                        vscode.window.showErrorMessage('error: ' + err);
                                                        return;
                                                    }
                                                    filesDiff[message.files_diff_index].tempPath1 = tempPathUri;
                                                    if (filesDiffType === 'd') {
                                                        const cpTemp2 = require('child_process');
                                                        cpTemp2.exec('mktemp', (err, stdout, stderr) => {
                                                            if (err) {
                                                                console.log('error: ' + err);
                                                                vscode.window.showErrorMessage('error: ' + err);
                                                                return;
                                                            }
                                                            const emptyTempFilePath = stdout.trim();
                                                            var emptyTempPathUri = vscode.Uri.parse("file://" + emptyTempFilePath);
                                                            filesDiff[message.files_diff_index].tempPath2 = emptyTempPathUri;
                                                            vscode.commands.executeCommand('vscode.diff', tempPathUri, emptyTempPathUri, "SVN DiffTO: " + filesDiffPath, {
                                                                preserveFocus: true,
                                                                viewColumn: vscode.ViewColumn.Beside
                                                            });
                                                        });
                                                    }
                                                    else /// m
                                                     {
                                                        const filePath = workspaceFolderPath + '/' + filesDiffPath;
                                                        var openPath = vscode.Uri.parse("file://" + filePath); //A request file path
                                                        filesDiff[message.files_diff_index].tempPath2 = openPath;
                                                        vscode.commands.executeCommand('vscode.diff', tempPathUri, openPath, "SVN DiffTO: " + filesDiffPath, {
                                                            preserveFocus: true,
                                                            viewColumn: vscode.ViewColumn.Beside
                                                        });
                                                    }
                                                });
                                            });
                                        }
                                        else {
                                            vscode.commands.executeCommand('vscode.diff', filesDiff[message.files_diff_index].tempPath1, filesDiff[message.files_diff_index].tempPath2, "SVN DiffTO: " + filesDiffPath, {
                                                preserveFocus: true,
                                                viewColumn: vscode.ViewColumn.Beside
                                            });
                                        }
                                    }
                                    return;
                            }
                        }, undefined, context.subscriptions);
                    });
                });
            });
        });
        quickPick.show();
    });
    context.subscriptions.push(disposable);
}
exports.activate = activate;
function getWebviewContent(difItemsSelectContent, cssUri) {
    return `<!DOCTYPE html>
<html lang="en">
	<head>
		<meta charset="UTF-8">
		<!--
			Use a content security policy to only allow loading images from https or from our extension directory,
			and only allow scripts that have a specific nonce.
		-->
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<title>SVN DiffTo</title>
	</head>
	<body height="100%" style="overflow: none;">
		<div>
			<h2>Diff items</h2>
			<select id="diff_select" onchange="onSelectChange()">
				${difItemsSelectContent}
			</select>
		</div>

		<script>
			const vscode = acquireVsCodeApi();
			function escapeHtml(str) {
				return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
			}
			function onSelectChange() {
				var files_diff_index = document.getElementById("diff_select").value;

				vscode.postMessage({
					command: 'onSelectChange',
					files_diff_index: files_diff_index
				})
			}
		</script>
	</body>
</html>`;
}
function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
// this method is called when your extension is deactivated
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map