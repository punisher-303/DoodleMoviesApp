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
    private val MAX_LOG_LINES = 200

    init {
        logToBuffer("Native Module Initialized on: ${System.getProperty("os.arch")}")
    }

    override fun getName(): String {
        return "TorrServerModule"
    }

    private fun logToBuffer(message: String) {
        val timestamped = "[${System.currentTimeMillis()}] $message"
        android.util.Log.d("TorrServer_NativeLog", timestamped)
        synchronized(logBuffer) {
            if (logBuffer.size >= MAX_LOG_LINES) {
                logBuffer.removeAt(0)
            }
            logBuffer.add(timestamped)
        }
    }

    @ReactMethod
    fun startServer(port: Int, promise: Promise) {
        logToBuffer(">>> startServer() called with port: $port")
        
        if (process != null && isAlive(process!!)) {
            logToBuffer("Engine already active. Reusing instance.")
            promise.resolve(true)
            return
        }

        try {
            val nativeLibDir = reactApplicationContext.applicationInfo.nativeLibraryDir
            val binaryPath = "$nativeLibDir/libtorrserver.so"
            val binaryFile = File(binaryPath)

            logToBuffer("Binary check: $binaryPath")
            if (!binaryFile.exists()) {
                logToBuffer("CRITICAL ERROR: libtorrserver.so NOT FOUND at $binaryPath")
                promise.reject("BINARY_NOT_FOUND", "Native binary missing.")
                return
            }

            logToBuffer("Binary size: ${binaryFile.length()} bytes")
            
            try {
                binaryFile.setExecutable(true)
                logToBuffer("setExecutable(true) called.")
            } catch (e: Exception) {
                logToBuffer("setExecutable failed: ${e.message}")
            }

            val dataDir = File(reactApplicationContext.filesDir, "torr_data")
            if (!dataDir.exists()) {
                dataDir.mkdirs()
            }
            logToBuffer("Working Dir: ${dataDir.absolutePath}")

            val command = mutableListOf(
                binaryPath,
                "-p", port.toString(),
                "-l", "127.0.0.1",
                "-d", dataDir.absolutePath
            )

            logToBuffer("COMMAND: ${command.joinToString(" ")}")
            
            val pb = ProcessBuilder(command)
            pb.directory(dataDir)
            pb.redirectErrorStream(true)
            
            val env = pb.environment()
            env["GODEBUG"] = "madvdontneed=1"
            env["HOME"] = dataDir.absolutePath
            
            logToBuffer("Starting process...")
            val p = pb.start()
            process = p

            // Output reader
            val reader = p.inputStream.bufferedReader()
            Thread {
                try {
                    logToBuffer("Reader thread started.")
                    var line: String? = reader.readLine()
                    while (line != null) {
                        logToBuffer("OUT: $line")
                        line = reader.readLine()
                    }
                    logToBuffer("Process stream closed.")
                } catch (e: Exception) {
                    logToBuffer("Reader error: ${e.message}")
                }
            }.start()

            Thread.sleep(2000)
            if (!isAlive(p)) {
                 val exitVal = p.exitValue()
                 logToBuffer("FATAL: Process died immediately. Exit Code: $exitVal")
                 promise.reject("CRASH", "Process died ($exitVal)")
                 return
            }

            logToBuffer("<<< startServer() success. Process is alive.")
            promise.resolve(true)
        } catch (e: Exception) {
            logToBuffer("EXCEPTION in startServer: ${e.message}")
            promise.reject("EXCEPTION", e.message)
        }
    }

    @ReactMethod
    fun getLogs(promise: Promise) {
        synchronized(logBuffer) {
            if (logBuffer.isEmpty()) {
                promise.resolve("Diagnostic Log Empty - Native Module exists but no events recorded.")
            } else {
                promise.resolve(logBuffer.joinToString("\n"))
            }
        }
    }

    @ReactMethod
    fun logMessage(message: String) {
        logToBuffer("[BRIDGE] $message")
    }

    @ReactMethod
    fun clearData(promise: Promise) {
        logToBuffer(">>> clearData() called")
        try {
            val dataDir = File(reactApplicationContext.filesDir, "torr_data")
            if (dataDir.exists()) {
                dataDir.deleteRecursively()
                dataDir.mkdirs()
                logToBuffer("Data directory wiped.")
            }
            promise.resolve(true)
        } catch (e: Exception) {
            logToBuffer("clearData EXCEPTION: ${e.message}")
            promise.reject("CLEAR_ERROR", e.message)
        }
    }

    @ReactMethod
    fun stopServer(promise: Promise) {
        logToBuffer(">>> stopServer() called")
        try {
            process?.destroy()
            process = null
            logToBuffer("Process destroyed.")
            promise.resolve(true)
        } catch (e: Exception) {
            logToBuffer("stopServer EXCEPTION: ${e.message}")
            promise.reject("STOP_ERROR", e.message)
        }
    }

    @ReactMethod
    fun isServerRunning(promise: Promise) {
        val running = process != null && isAlive(process!!)
        promise.resolve(running)
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
