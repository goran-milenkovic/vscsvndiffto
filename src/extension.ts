// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { SVNDiffToProvider, SVNDiffToItemType } from './SVNDiffToProvider';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('svndiffto.svndiffto', (params) => {
		let workspaceFolders = vscode.workspace.workspaceFolders;
		if(typeof workspaceFolders === 'undefined')
		{
			workspaceFolders = [];
		}
		if(workspaceFolders.length === 0)
		{
			vscode.window.showErrorMessage('No workspace folders');
			return;
		}
		const workspaceFolderPaths = workspaceFolders.map(wsf => wsf.uri.path);

		const workspaceFolderPath = params.path;

		let placeHolderSufix = '';
		for(let i=0; i<workspaceFolderPaths.length; i++)
		{
			const wsfpath = workspaceFolderPaths[i];
			if(wsfpath === workspaceFolderPath)
			{
				break;
			}
			else if(workspaceFolderPath.startsWith(wsfpath))
			{
				placeHolderSufix = workspaceFolderPath.substring(wsfpath.length);
				break;
			}
		}

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

			let relativeUrlLine = '';
			let repositoryRootLine = '';
			let isSingleFileDiff = false;
			projectSvnInfoLines.forEach(line => {
				const lineTrim = line.trim();
				if(lineTrim.startsWith('Relative URL: '))
				{
					relativeUrlLine = lineTrim;
				}
				else if(lineTrim.startsWith('Repository Root: '))
				{
					repositoryRootLine = lineTrim;
				}
				else if(lineTrim.startsWith('Name: '))
				{
					isSingleFileDiff = true;
				}
			});
			if(relativeUrlLine === '')
			{
				vscode.window.showErrorMessage('svn info no relative url line');
				return;
			}
			if(repositoryRootLine === '')
			{
				vscode.window.showErrorMessage('svn info no repository root line');
				return;
			}

			const projectRelativeUrl = relativeUrlLine.substring(14);
			const projectRepositoryRoot = repositoryRootLine.substring(17);

			const projectRelativeUrlClean = projectRelativeUrl.replace(/^(\^\/)/,"");

			generatingStatusMessage.dispose();

			const initialValue = "^/trunk" + placeHolderSufix;

			let svntagOptions: vscode.InputBoxOptions = {
				prompt: "Choose with what to diff: ",
				value: initialValue,
				placeHolder: initialValue
			};

			generatingStatusMessage.dispose();

			vscode.window.showInputBox(svntagOptions).then(value => {	
				let answer = value;
				if (!answer || typeof answer === 'undefined')
				{
					answer = initialValue;
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
							'type': SVNDiffToItemType.loading
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
								'type': SVNDiffToItemType.loading
							}
						])
					);

					const svndiffContentArray = stdout.split('Index: ');
					const svndiffContentArrayLength = svndiffContentArray.length;

					const cpTemp1 = require('child_process');
					const cpTemp1Stdout = cpTemp1.execSync('mktemp');

					const tempFilePath = cpTemp1Stdout.toString().trim();
					var emptyTempPathUri = vscode.Uri.parse("file://" + tempFilePath);

					let treeData: any[] = [];
					let parsingCounter = 0;
					svndiffContentArray.forEach(element => {

						parsingCounter++;

						vscode.window.registerTreeDataProvider(
							'svndiffto',
							new SVNDiffToProvider([
								{
									'path': 'Generating DiffTo - parsing '+ parsingCounter + '/' + svndiffContentArrayLength,
									'type': SVNDiffToItemType.loading
								}
							])
						);

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
						
						const elementLines2 = elementLines[2];
						const elementLines3 = elementLines[3];
						
						var elementType = SVNDiffToItemType.unknown;

						if(elementLines2.includes('(revision ') && elementLines3.includes('(revision '))
						{
							elementType = SVNDiffToItemType.svnModify;
						}
						else if(elementLines2.endsWith('(nonexistent)') && elementLines3.includes('(revision '))
						{
							elementType = SVNDiffToItemType.svnAdd;
						}
						else if(elementLines3.endsWith('(nonexistent)') && elementLines2.includes('(revision '))
						{
							elementType = SVNDiffToItemType.svnDelete;
						}
						if(elementLines2 === 'Cannot display: file marked as a binary type.')
						{
							elementLines.forEach((elementLine: string) => {
								if(elementLine === 'Added: svn:mime-type')
								{
									elementType = SVNDiffToItemType.svnAdd;
								}
							});
						}

						let filePath = workspaceFolderPath;
						if(isSingleFileDiff === false)
						{
							filePath += '/' + path;
						}
						var openPath = vscode.Uri.parse("file://" + filePath); //A request file path

						let leftFile = null;
						let rightFile = null;

						if(elementType === SVNDiffToItemType.svnAdd)
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

							let svnPath = svnOld;
							if(isSingleFileDiff === false)
							{
								svnPath += '/' + path;
							}
							const cp3 = require('child_process');
							cp3.execSync('svn cat '+svnPath+' > '+tempFilePath, {maxBuffer: 1024*1024*1024});

							if(elementType === SVNDiffToItemType.svnDelete)
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
								'type': SVNDiffToItemType.loading
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
