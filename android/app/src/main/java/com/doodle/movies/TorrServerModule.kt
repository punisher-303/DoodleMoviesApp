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
        if (process != null && isAlive(process!!)) {
            android.util.Log.d("TorrServerModule", "Engine already active")
            promise.resolve(true)
            return
        }

        try {
            val nativeLibDir = reactApplicationContext.applicationInfo.nativeLibraryDir
            val binaryPath = "$nativeLibDir/libtorrserver.so"
            val binaryFile = File(binaryPath)

            if (!binaryFile.exists()) {
                android.util.Log.e("TorrServerModule", "CRITICAL: Binary not found at $binaryPath")
                promise.reject("BINARY_NOT_FOUND", "Engine binary missing from deployment.")
                return
            }

            // Restore executable permission for safety on physical devices
            try {
                binaryFile.setExecutable(true)
                android.util.Log.d("TorrServerModule", "Executable permission set")
            } catch (e: Exception) {
                android.util.Log.w("TorrServerModule", "Failed to set executable (expected on some OS versions)")
            }

            // Ensure directory for data exists
            val dataDir = File(reactApplicationContext.filesDir, "torr_data")
            if (!dataDir.exists()) {
                dataDir.mkdirs()
            }

            // --- DEEP CLEANING: Remove stale lock files ---
            val lockFiles = dataDir.listFiles { _, name -> name.endsWith(".lock") || name.contains("lock") }
            lockFiles?.forEach { 
                android.util.Log.d("TorrServerModule", "Removing stale lock: ${it.name}")
                it.delete() 
            }

            val command = mutableListOf(
                binaryPath,
                "-p", port.toString(),
                "-d", dataDir.absolutePath,
                "-l", "0.0.0.0" // Explicitly bind to all interfaces for loopback accessibility
            )

            android.util.Log.d("TorrServerModule", "Launching engine: $command")
            val pb = ProcessBuilder(command)
            pb.directory(dataDir)
            pb.redirectErrorStream(true)
            
            val env = pb.environment()
            env["GODEBUG"] = "madvdontneed=1"
            env["HOME"] = dataDir.absolutePath
            
            val p = pb.start()
            process = p

            // Monitor output for first 800ms
            val startTime = System.currentTimeMillis()
            val reader = p.inputStream.bufferedReader()
            val sb = StringBuilder()
            
            // Background thread to log process output
            Thread {
                try {
                    var line: String? = reader.readLine()
                    while (line != null) {
                        android.util.Log.d("TorrServer_Output", line)
                        line = reader.readLine()
                    }
                } catch (e: Exception) {}
            }.start()

            Thread.sleep(800)
            if (!isAlive(p)) {
                 val exitVal = p.exitValue()
                 android.util.Log.e("TorrServerModule", "Process died immediately with code: $exitVal")
                 promise.reject("CRASH", "Engine died immediately (Code $exitVal)")
                 return
            }

            android.util.Log.d("TorrServerModule", "Engine started successfully")
            promise.resolve(true)
        } catch (e: Exception) {
            android.util.Log.e("TorrServerModule", "Uncaught Start Error: ${e.message}", e)
            promise.reject("EXCEPTION", e.message)
        }
    }

    @ReactMethod
    fun clearData(promise: Promise) {
        try {
            val dataDir = File(reactApplicationContext.filesDir, "torr_data")
            if (dataDir.exists()) {
                dataDir.deleteRecursively()
                dataDir.mkdirs()
                android.util.Log.d("TorrServerModule", "Engine data cleared")
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
