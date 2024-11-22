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

    // Commande pour définir le fichier cible
    let setFileCommand = vscode.commands.registerCommand('regexVisualizer.setFile', async () => {
        const input = await vscode.window.showInputBox({
            prompt: 'Entrez le chemin relatif du fichier',
            placeHolder: 'ex: .env ou src/config/.env'
        });

        if (input) {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                vscode.window.showErrorMessage('Aucun workspace ouvert');
                return;
            }

            const workspaceRoot = workspaceFolders[0].uri.fsPath;
            const absolutePath = path.join(workspaceRoot, input);

            if (!fs.existsSync(absolutePath)) {
                vscode.window.showErrorMessage(`Le fichier ${input} n'existe pas`);
                return;
            }

            await vscode.workspace.getConfiguration().update('regexVisualizer.filePath', absolutePath, true);
            updateStatusBar();
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
        const targetPath = config.get<string>('filePath');
        if (targetPath && document.uri.fsPath === targetPath) {
            updateStatusBar();
        }
    }));

    context.subscriptions.push(setPatternCommand);
    context.subscriptions.push(setFileCommand);

    // Initialiser la barre de statut
    updateStatusBar();
}

function updateStatusBar() {
    const config = vscode.workspace.getConfiguration('regexVisualizer');
    const pattern = config.get<string>('pattern');
    const filePath = config.get<string>('filePath');

    if (!pattern || !filePath) {
        statusBarItem.text = '$(regex) Regex: Non configuré';
        statusBarItem.show();
        return;
    }

    try {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const regex = new RegExp(pattern, 'm');
        const match = fileContent.match(regex);

        if (match && match[1]) {
            statusBarItem.text = `$(regex) Match: ${match[1]}`;
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
