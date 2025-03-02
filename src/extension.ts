import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
    // Créer l'élément de la barre de statut
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    context.subscriptions.push(statusBarItem);

    // Commande pour définir le pattern regex
    let setPatternCommand = vscode.commands.registerCommand('regexVisualizer.setPattern', async () => {
        const pattern = await vscode.window.showInputBox({
            prompt: 'Entrez votre expression régulière',
            placeHolder: 'ex: \\d+'
        });
        if (pattern) {
            await vscode.workspace.getConfiguration().update('regexVisualizer.pattern', pattern, true);
            updateStatusBar();
        }
    });

    // Commande pour définir le chemin du fichier
    let setFilePathCommand = vscode.commands.registerCommand('regexVisualizer.setFilePath', async () => {
        // Obtenir la liste des fichiers dans l'espace de travail
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('Aucun espace de travail ouvert');
            return;
        }

        // Demander à l'utilisateur s'il veut parcourir les fichiers ou saisir directement le nom
        const choice = await vscode.window.showQuickPick(
            [
                { label: 'Parcourir les fichiers', id: 'browse' },
                { label: 'Saisir le nom du fichier', id: 'input' }
            ],
            { placeHolder: 'Comment voulez-vous spécifier le fichier?' }
        );

        if (!choice) {
            return;
        }

        if (choice.id === 'browse') {
            // Utiliser QuickPick pour permettre à l'utilisateur de sélectionner un fichier
            const uris = await vscode.workspace.findFiles('**/*', '**/node_modules/**');
            const items = uris.map(uri => {
                const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
                if (!workspaceFolder) {
                    return { label: uri.fsPath, uri };
                }
                // Obtenir le chemin relatif à l'espace de travail
                const relativePath = path.relative(workspaceFolder.uri.fsPath, uri.fsPath);
                return { label: relativePath, uri };
            });

            const selectedItem = await vscode.window.showQuickPick(items, {
                placeHolder: 'Sélectionnez un fichier à analyser'
            });

            if (selectedItem) {
                await vscode.workspace.getConfiguration().update('regexVisualizer.filePath', selectedItem.label, true);
                updateStatusBar();
            }
        } else {
            // Permettre à l'utilisateur de saisir directement le nom du fichier
            const filePath = await vscode.window.showInputBox({
                prompt: 'Entrez le chemin du fichier (relatif à l\'espace de travail)',
                placeHolder: 'ex: .env, config/settings.json'
            });

            if (filePath) {
                // Vérifier si le fichier existe
                const fullPath = path.join(workspaceFolders[0].uri.fsPath, filePath);
                if (fs.existsSync(fullPath)) {
                    await vscode.workspace.getConfiguration().update('regexVisualizer.filePath', filePath, true);
                    updateStatusBar();
                } else {
                    vscode.window.showErrorMessage(`Le fichier "${filePath}" n'existe pas dans l'espace de travail.`);
                }
            }
        }
    });

    // Observer les changements de configuration
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('regexVisualizer')) {
            updateStatusBar();
        }
    }));

    // Observer les changements de fichier
    context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(document => {
        const config = vscode.workspace.getConfiguration('regexVisualizer');
        const filePath = config.get<string>('filePath');
        
        if (filePath) {
            // Si un fichier spécifique est configuré, vérifier si c'est celui qui a été modifié
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (workspaceFolders) {
                const fullPath = path.join(workspaceFolders[0].uri.fsPath, filePath);
                if (document.uri.fsPath === fullPath) {
                    updateStatusBar();
                }
            }
        } else {
            // Comportement par défaut: vérifier si le fichier actif a été modifié
            const activeEditor = vscode.window.activeTextEditor;
            if (activeEditor && activeEditor.document.uri.fsPath === document.uri.fsPath) {
                updateStatusBar();
            }
        }
    }));

    context.subscriptions.push(setPatternCommand);
    context.subscriptions.push(setFilePathCommand);

    // Initialiser la barre de statut
    updateStatusBar();
}

function updateStatusBar() {
    const config = vscode.workspace.getConfiguration('regexVisualizer');
    const pattern = config.get<string>('pattern');
    const configuredFilePath = config.get<string>('filePath');
    
    if (!pattern) {
        statusBarItem.text = '$(regex) Regex: Pattern non configuré';
        statusBarItem.show();
        return;
    }

    let filePath: string | undefined;
    
    if (configuredFilePath) {
        // Utiliser le fichier configuré
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders) {
            filePath = path.join(workspaceFolders[0].uri.fsPath, configuredFilePath);
        }
    } else {
        // Utiliser le fichier actif (comportement par défaut)
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
            filePath = activeEditor.document.uri.fsPath;
        }
    }

    if (!filePath) {
        statusBarItem.text = '$(regex) Regex: Aucun fichier spécifié';
        statusBarItem.show();
        return;
    }

    // Vérifier si le fichier existe
    if (!fs.existsSync(filePath)) {
        statusBarItem.text = `$(error) Fichier non trouvé: ${configuredFilePath || 'fichier actif'}`;
        statusBarItem.show();
        return;
    }

    try {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const regex = new RegExp(pattern, 'm');
        const match = fileContent.match(regex);

        if (match && match[1]) {
            statusBarItem.text = `$(regex) Match: ${match[1]}`;
        } else if (match) {
            // Si on a un match mais pas de groupe capturant
            statusBarItem.text = `$(regex) Match trouvé: ${match[0]}`;
        } else {
            statusBarItem.text = '$(regex) Aucun match trouvé';
        }
    } catch (err: any) {
        const error = err as Error;
        statusBarItem.text = `$(error) Erreur: ${error.message || 'Erreur inconnue'}`;
    }

    statusBarItem.show();
}

export function deactivate() {
    if (statusBarItem) {
        statusBarItem.dispose();
    }
}
