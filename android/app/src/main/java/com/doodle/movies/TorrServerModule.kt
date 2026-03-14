package com.doodle.movies

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import java.io.File
import java.io.IOException

class TorrServerModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    private var process: Process? = null
    private val logBuffer = mutableListOf<String>()
    private val MAX_LOG_LINES = 150

    init {
        android.util.Log.d("TorrServerModule", "Initialized on arch: ${System.getProperty("os.arch")}")
    }

    override fun getName(): String {
        return "TorrServerModule"
    }

    private fun logToBuffer(message: String) {
        val timestamped = "[${System.currentTimeMillis()}] $message"
        android.util.Log.d("TorrServer_Log", timestamped)
        synchronized(logBuffer) {
            if (logBuffer.size >= MAX_LOG_LINES) {
                logBuffer.removeAt(0)
            }
            logBuffer.add(timestamped)
        }
    }

    @ReactMethod
    fun startServer(port: Int, promise: Promise) {
        synchronized(logBuffer) {
            logBuffer.clear()
        }
        logToBuffer("Engine Startup Initiated. Port: $port")
        logToBuffer("System Arch: ${System.getProperty("os.arch")}")

        if (process != null && isAlive(process!!)) {
            logToBuffer("Engine already active. Reusing instance.")
            promise.resolve(true)
            return
        }

        try {
            val nativeLibDir = reactApplicationContext.applicationInfo.nativeLibraryDir
            val binaryPath = "$nativeLibDir/libtorrserver.so"
            val binaryFile = File(binaryPath)

            logToBuffer("Binary Path: $binaryPath")
            if (!binaryFile.exists()) {
                logToBuffer("CRITICAL: Binary not found at $binaryPath")
                promise.reject("BINARY_NOT_FOUND", "Engine binary missing from deployment.")
                return
            }

            // Restore executable permission for safety
            try {
                binaryFile.setExecutable(true)
                logToBuffer("Executable permission set: success")
            } catch (e: Exception) {
                logToBuffer("Executable permission set: failed (${e.message})")
            }

            val dataDir = File(reactApplicationContext.filesDir, "torr_data")
            if (!dataDir.exists()) {
                dataDir.mkdirs()
            }
            logToBuffer("Data Dir: ${dataDir.absolutePath}")

            // Cleaning stale locks
            val lockFiles = dataDir.listFiles { _, name -> name.endsWith(".lock") || name.contains("lock") }
            lockFiles?.forEach { 
                logToBuffer("Removing stale lock: ${it.name}")
                it.delete() 
            }

            val command = mutableListOf(
                binaryPath,
                "-p", port.toString(),
                "-l", "127.0.0.1",
                "-d", dataDir.absolutePath
            )

            logToBuffer("Executing Command: $command")
            val pb = ProcessBuilder(command)
            pb.directory(dataDir)
            pb.redirectErrorStream(true)
            
            val env = pb.environment()
            env["GODEBUG"] = "madvdontneed=1"
            env["HOME"] = dataDir.absolutePath
            env["TORR_LOG"] = "1"
            
            val p = pb.start()
            process = p
            logToBuffer("Process started. PID check follows...")

            // Background thread to log process output
            val reader = p.inputStream.bufferedReader()
            Thread {
                try {
                    var line: String? = reader.readLine()
                    while (line != null) {
                        logToBuffer("BT: $line")
                        line = reader.readLine()
                    }
                } catch (e: Exception) {
                    logToBuffer("Reader Thread Error: ${e.message}")
                }
            }.start()

            Thread.sleep(1500)
            if (!isAlive(p)) {
                 val exitVal = p.exitValue()
                 logToBuffer("CRASH: Process died with code: $exitVal")
                 promise.reject("CRASH", "Engine died immediately (Code $exitVal)")
                 return
            }

            logToBuffer("Engine Startup Verified. Alive = true.")
            promise.resolve(true)
        } catch (e: Exception) {
            logToBuffer("START ERROR: ${e.message}")
            promise.reject("EXCEPTION", e.message)
        }
    }

    @ReactMethod
    fun getLogs(promise: Promise) {
        synchronized(logBuffer) {
            if (logBuffer.isEmpty()) {
                promise.resolve("Diagnostic Log: Buffer is empty. Engine hasn't been started since last clear.")
            } else {
                promise.resolve(logBuffer.joinToString("\n"))
            }
        }
    }

    @ReactMethod
    fun clearData(promise: Promise) {
        try {
            val dataDir = File(reactApplicationContext.filesDir, "torr_data")
            if (dataDir.exists()) {
                dataDir.deleteRecursively()
                dataDir.mkdirs()
                logToBuffer("Command: clearData successful")
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("CLEAR_ERROR", e.message)
        }
    }

    @ReactMethod
    fun stopServer(promise: Promise) {
        try {
            process?.destroy()
            process = null
            logToBuffer("Command: stopServer successful")
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("STOP_ERROR", e.message)
        }
    }

    @ReactMethod
    fun isServerRunning(promise: Promise) {
        val isRunning = process != null && isAlive(process!!)
        promise.resolve(isRunning)
    }

    private fun isAlive(p: Process): Boolean {
        return try {
            p.exitValue()
            false
        } catch (e: IllegalThreadStateException) {
            true
        }
    }
}
