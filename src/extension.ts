// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { SVNDiffToProvider } from './SVNDiffToProvider';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('svndiffto.svndiffto', (params) => {		
		const workspaceFolderPath = params.path;
		const pickedProject = workspaceFolderPath.substring(workspaceFolderPath.lastIndexOf("/")+1);

		let generatingStatusMessage = vscode.window.setStatusBarMessage('fetching svn info');

		const cp1 = require('child_process');
		cp1.exec('svn info '+workspaceFolderPath, (err: string, stdout: string, stderr: string) => {
			if (err) {
				console.log('error: ' + err);
				vscode.window.showErrorMessage('error: ' + err);
				return;
			}

			generatingStatusMessage.dispose();
			generatingStatusMessage = vscode.window.setStatusBarMessage('parsing fetched svn info');

			let projectSvnInfoLines = stdout.match(/[^\r\n]+/g);

			if(projectSvnInfoLines === null)
			{
				vscode.window.showErrorMessage('svn info empty');
				return;
			}

			const relativeUrlLine = projectSvnInfoLines[3];
			const repositoryRootLine = projectSvnInfoLines[4];

			const projectRelativeUrl = relativeUrlLine.substring(14);
			const projectRepositoryRoot = repositoryRootLine.substring(17);

			const projectRelativeUrlClean = projectRelativeUrl.replace(/^(\^\/)/,"");

			generatingStatusMessage.dispose();

			let svntagOptions: vscode.InputBoxOptions = {
				prompt: "Choose with what to diff: ",
				placeHolder: "^/trunk"
			};

			generatingStatusMessage.dispose();

			vscode.window.showInputBox(svntagOptions).then(value => {	
				let answer = value;
				if (!answer || typeof answer === 'undefined')
				{
					answer = '^/trunk';
				}
				const finalAnswer = answer;

				const answerClean = finalAnswer.replace(/^(\^\/)/,"");

				const svnOld = projectRepositoryRoot + '/' + answerClean;
				const svnNew = projectRepositoryRoot + '/' + projectRelativeUrlClean;

				generatingStatusMessage = vscode.window.setStatusBarMessage('Generating DiffTo - fetching from server...');
				vscode.window.registerTreeDataProvider(
					'svndiffto',
					new SVNDiffToProvider([
						{
							'path': 'Generating DiffTo - fetching from server...',
							'type': null,
							'leftFile': null,
							'rightFile': null
						}
					])
				);

				const cp2 = require('child_process');
				cp2.exec('svn diff --old='+svnOld+' --new='+svnNew, {maxBuffer: 1024*1024*1024}, (err: string, stdout: string, stderr: string) => {
					if (err) {
						console.log('error: ' + err);
						vscode.window.showErrorMessage('error: ' + err);
						return;
					}

					generatingStatusMessage.dispose();
					let parsingStatusMessage = vscode.window.setStatusBarMessage('Generating DiffTo - parsing');
					vscode.window.registerTreeDataProvider(
						'svndiffto',
						new SVNDiffToProvider([
							{
								'path': 'Generating DiffTo - parsing',
								'type': null,
								'leftFile': null,
								'rightFile': null
							}
						])
					);

					const svndiffContentArray = stdout.split('Index: ');

					const cpTemp1 = require('child_process');
					const cpTemp1Stdout = cpTemp1.execSync('mktemp');

					const tempFilePath = cpTemp1Stdout.toString().trim();
					var emptyTempPathUri = vscode.Uri.parse("file://" + tempFilePath);

					let treeData: any[] = [];
					svndiffContentArray.forEach(element => {
						if(element.trim().length === 0)
						{
							return;
						}

						const elementLines = element.split("\n");
						const path = elementLines[0];
						if(path === '.')
						{
							return; /// continue
						}

						var elementAddLines = 0;
						var elementDeleteLines = 0;
						elementLines.forEach((elementLine: string) => {
							if(elementLine.startsWith("-"))
							{
								elementDeleteLines++;
							}
							else if(elementLine.startsWith("+"))
							{
								elementAddLines++;
							}
						});
						var elementType = 'M';
						if(elementDeleteLines === 1)
						{
							elementType = 'A';
						}
						else if(elementAddLines === 1)
						{
							elementType = 'D';
						}

						const filePath = workspaceFolderPath + '/' + path;
						var openPath = vscode.Uri.parse("file://" + filePath); //A request file path

						let leftFile = null;
						let rightFile = null;

						if(elementType === 'A')
						{
							leftFile = emptyTempPathUri;
							rightFile = openPath;
						}
						else
						{
							const cpTemp2 = require('child_process');
							const cpTemp2Stdout = cpTemp2.execSync('mktemp');

							const tempFilePath = cpTemp2Stdout.toString().trim();
							var tempPathUri = vscode.Uri.parse("file://" + tempFilePath);

							const svnPath = svnOld + '/' + path;
							const cp3 = require('child_process');
							cp3.execSync('svn cat '+svnPath+' > '+tempFilePath, {maxBuffer: 1024*1024*1024});

							if(elementType === 'D')
							{
								leftFile = tempPathUri;
								rightFile = emptyTempPathUri;
							}
							else /// m
							{
								leftFile = tempPathUri;
								rightFile = openPath;
							}
						}

						treeData.push({
							'path': path,
							'type': elementType,
							'leftFile': leftFile,
							'rightFile': rightFile
						});
					});

					vscode.window.registerTreeDataProvider(
						'svndiffto',
						new SVNDiffToProvider([
							{
								'path': 'Generating DiffTo - done',
								'type': null,
								'leftFile': null,
								'rightFile': null
							}
						])
					);

					vscode.window.registerTreeDataProvider(
						'svndiffto',
						new SVNDiffToProvider(treeData)
					);

					parsingStatusMessage.dispose();
					vscode.window.setStatusBarMessage('Generating DiffTo done', 2000);
				});
			});
		});
	});

	context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}
