import { window, workspace, ExtensionContext, Uri, languages, ProgressLocation, Progress, CancellationToken } from 'vscode';
import JavaCodeProvider from '../provider/JavaCodeProvider';
import { SmaliDecompilerFactoryImpl } from '../decompiler/impl/SmaliDecompilerFactoryImpl';
import { SmaliDecompilerFactory } from '../decompiler/SmaliDecompilerFactory';
import { join } from 'path';

async function showDecompileResult(uri: Uri, provider: JavaCodeProvider) {
    const loadedDocument = workspace.textDocuments.find(document => !document.isClosed && document.uri.toString() == uri.toString())
    if (loadedDocument) {
        provider.onDidChangeEmitter.fire(uri)
        await window.showTextDocument(loadedDocument, { preview: false, preserveFocus: true })
        return 
    }
    const textDoc = await workspace.openTextDocument(uri);
    const javaDoc = await languages.setTextDocumentLanguage(textDoc, "java")
    await window.showTextDocument(javaDoc, { preview: false, preserveFocus: true })
}

export default (context: ExtensionContext, provider: JavaCodeProvider) => {
    const decompilerFactory: SmaliDecompilerFactory = new SmaliDecompilerFactoryImpl(join(context.globalStorageUri.fsPath, "decompiled"))
    const decompileProgressOptions = {
        location: ProgressLocation.Notification,
        title: "反编译中...",
        cancellable: true
    }
    return async (uri: Uri) => window.withProgress(decompileProgressOptions, async (progress: Progress<{ message?: string; increment?: number }>, token: CancellationToken) => {
        try {
            uri = uri ?? window.activeTextEditor?.document?.uri
            if (!uri) throw { message: "没有活动的文档" }
            const decompiler = decompilerFactory.getSmailDecompiler("jadx")
            const resultUri = await decompiler.decompile(uri)
            showDecompileResult(resultUri, provider)
        } catch(err: any) {
            window.showErrorMessage(`反编译失败: ${err.message}`)
        }
    })
}
