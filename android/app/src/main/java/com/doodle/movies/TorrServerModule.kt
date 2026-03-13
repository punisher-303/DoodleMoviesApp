package com.doodle.movies

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import java.io.File
import java.io.IOException

class TorrServerModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    private var process: Process? = null

    init {
        android.util.Log.d("TorrServerModule", "Initialized on arch: ${System.getProperty("os.arch")}")
    }

    override fun getName(): String {
        return "TorrServerModule"
    }

    @ReactMethod
    fun startServer(port: Int, promise: Promise) {
        if (process != null) {
            promise.resolve(true)
            return
        }

        try {
            val nativeLibDir = reactApplicationContext.applicationInfo.nativeLibraryDir
            val binaryPath = "$nativeLibDir/libtorrserver.so"
            val binaryFile = File(binaryPath)

            android.util.Log.d("TorrServerModule", "Checking binary at: $binaryPath")
            android.util.Log.d("TorrServerModule", "Binary exists: ${binaryFile.exists()}")
            android.util.Log.d("TorrServerModule", "Binary can execute: ${binaryFile.canExecute()}")

            if (!binaryFile.exists()) {
                // Defensive: check if it's named without lib prefix or something else
                android.util.Log.e("TorrServerModule", "CRITICAL: Binary not found at $binaryPath")
                promise.reject("BINARY_NOT_FOUND", "TorrServer binary not found at $binaryPath")
                return
            }

            // Ensure binary is executable
            binaryFile.setExecutable(true)
            android.util.Log.d("TorrServerModule", "SetExecutable true called")

            // Ensure directory for data exists
            val dataDir = File(reactApplicationContext.filesDir, "torr_data")
            if (!dataDir.exists()) {
                dataDir.mkdirs()
            }

            android.util.Log.d("TorrServerModule", "Data directory: ${dataDir.absolutePath}")

            val command = mutableListOf(
                binaryPath,
                "-p", port.toString(),
                "-d", dataDir.absolutePath,
                "-k" // --dontkill: don't kill existing instance
            )

            android.util.Log.d("TorrServerModule", "Starting process with command: $command")
            val processBuilder = ProcessBuilder(command)
            processBuilder.directory(dataDir)
            
            // Set environment variables if needed
            val env = processBuilder.environment()
            env["GODEBUG"] = "madvdontneed=1"

            process = processBuilder.start()
            android.util.Log.d("TorrServerModule", "Process started successfully")
            
            promise.resolve(true)
        } catch (e: Exception) {
            android.util.Log.e("TorrServerModule", "Start error: ${e.message}", e)
            promise.reject("START_ERROR", e.message)
        }
    }

    @ReactMethod
    fun stopServer(promise: Promise) {
        try {
            process?.destroy()
            process = null
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
