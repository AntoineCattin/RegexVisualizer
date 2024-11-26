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

    // Observer les changements de configuration
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('regexVisualizer')) {
            updateStatusBar();
        }
    }));

    // Observer les changements de fichier
    context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(document => {
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor && activeEditor.document.uri.fsPath === document.uri.fsPath) {
            updateStatusBar();
        }
    }));

    context.subscriptions.push(setPatternCommand);

    // Initialiser la barre de statut
    updateStatusBar();
}

function updateStatusBar() {
    const config = vscode.workspace.getConfiguration('regexVisualizer');
    const pattern = config.get<string>('pattern');
    
    // Obtenir le document actif
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
        statusBarItem.text = '$(regex) Regex: Aucun fichier ouvert';
        statusBarItem.show();
        return;
    }

    const filePath = activeEditor.document.uri.fsPath;

    if (!pattern) {
        statusBarItem.text = '$(regex) Regex: Pattern non configuré';
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
