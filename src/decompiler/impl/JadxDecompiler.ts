import { DecompileError, SmaliDecompiler } from "../SmaliDecompiler"
import { OutputChannel, Uri, workspace } from "vscode";
import { join } from "path";
import { promises as fsAsync } from "fs"
import JavaCodeProvider from "../../provider/JavaCodeProvider";
import { promisify } from 'util'
import { exec } from "child_process"
import { getSmaliDocumentClassNameFromUri } from "../../util/smali-util";

const execAsync = promisify(exec)

interface JadxConfig {
    path?: string,
    options?: string
}

export class JadxDecompiler implements SmaliDecompiler {
    constructor(
        public sourceOutputDir: string,
        public outputChannel: OutputChannel,
    ) {
    }

    private getOutputFilePath(smaliClassName: string) {
        return join(this.sourceOutputDir, (smaliClassName.includes("/") ? "" : "defpackage/") + smaliClassName + ".java")
    }

    private async loadConfig(): Promise<JadxConfig> {
        const config = workspace.getConfiguration("smali2java.decompiler.jadx")
        return {
            path: config.get("path"),
            options: config.get("options")
        }
    }

    async decompile(smaliFileUri: Uri): Promise<Uri> {
        const smaliClassName = await getSmaliDocumentClassNameFromUri(smaliFileUri)
        if (!smaliClassName) throw new DecompileError("无效的 smali 文件")
        const config = await this.loadConfig()
        if (!config.path) throw new DecompileError("Jadx 可执行文件路径未配置")
        if (!(await fsAsync.stat(config.path)).isFile()) throw new DecompileError("无效的 Jadx 可执行文件路径")
        const outputFilePath = this.getOutputFilePath(smaliClassName)
        const { stdout, stderr } = await execAsync(`${await config.path} ${this.quote(smaliFileUri.fsPath)} -ds ${this.quote(this.sourceOutputDir)} ${config.options ?? ""}`)
        this.outputChannel.append(stdout)
        if (stderr && stderr.length > 0) {
            this.outputChannel.show()
            this.outputChannel.append(stderr)
            throw new DecompileError("查看输出以获取更多信息")
        }
        try {
            await fsAsync.stat(outputFilePath)
        } catch(e) {
            throw new DecompileError(`读取时发生错误: ${outputFilePath}: ${e}`)
        }
        // Return a compact display path (keeps tab title short) and
        // place the real filesystem path into the URI query so the
        // content provider can read the actual file from disk.
        return Uri.from({
            scheme: JavaCodeProvider.scheme,
            path: '/' + smaliClassName + '.java',
            query: encodeURIComponent(outputFilePath)
        })
    }

    private quote(str: string) {
        if (process.platform == "win32") {
            return `"${str}"`
        }
        return `'${str}'`
    }
}
