package expo.modules.geminano

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Base64
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import com.google.mlkit.genai.imagedescription.ImageDescription
import com.google.mlkit.genai.imagedescription.ImageDescriber
import com.google.mlkit.genai.imagedescription.ImageDescriberOptions
import com.google.mlkit.genai.imagedescription.ImageDescriptionRequest
import com.google.mlkit.genai.common.DownloadCallback
import com.google.mlkit.genai.common.GenAiException
import java.util.concurrent.Executors

class GeminiNanoModule : Module() {
    private var imageDescriber: ImageDescriber? = null
    private val executor = Executors.newSingleThreadExecutor()

    override fun definition() = ModuleDefinition {
        Name("GeminiNano")

        AsyncFunction("initialize") { promise: Promise ->
            try {
                val context = appContext.reactContext
                    ?: throw Exception("No context available")
                val options = ImageDescriberOptions.builder(context).build()
                val describer = ImageDescription.getClient(options)

                // Check feature status (non-blocking via addListener)
                val statusFuture = describer.checkFeatureStatus()
                statusFuture.addListener({
                    try {
                        val status = statusFuture.get()
                        android.util.Log.d("GeminiNano", "Feature status: $status")

                        // FeatureStatus: 0=UNAVAILABLE, 1=DOWNLOADABLE, 2=DOWNLOADING, 3=AVAILABLE
                        when (status) {
                            3 -> prepareEngine(describer, promise)
                            2 -> promise.reject("DOWNLOADING", "Model is currently downloading in the background.", null)
                            1 -> downloadAndPrepare(describer, promise)
                            0 -> promise.reject("UNAVAILABLE", "Image Description not available on this device", null)
                            else -> promise.reject("STATUS_ERROR", "Unknown status: $status", null)
                        }
                    } catch (e: Exception) {
                        promise.reject("STATUS_ERROR", "Status check failed: ${e.message}", e)
                    }
                }, executor)
            } catch (e: Exception) {
                promise.reject("INIT_ERROR", "Initialization failed: ${e.message}", e)
            }
        }

        AsyncFunction("describeImage") { base64: String, promise: Promise ->
            try {
                val describer = imageDescriber
                    ?: throw Exception("Model not initialized. Call initialize() first.")

                val bitmap = base64ToBitmap(base64)
                val request = ImageDescriptionRequest.builder(bitmap).build()

                val future = describer.runInference(request)
                future.addListener({
                    try {
                        val result = future.get()
                        val description = result.description
                        bitmap.recycle()
                        promise.resolve(description)
                    } catch (e: Exception) {
                        bitmap.recycle()
                        promise.reject("DESCRIBE_ERROR", "Description failed: ${e.message}", e)
                    }
                }, executor)
            } catch (e: Exception) {
                promise.reject("DESCRIBE_ERROR", "Description failed: ${e.message}", e)
            }
        }

        AsyncFunction("checkStatus") { promise: Promise ->
            try {
                val context = appContext.reactContext
                    ?: throw Exception("No context available")
                val options = ImageDescriberOptions.builder(context).build()
                val describer = ImageDescription.getClient(options)

                val future = describer.checkFeatureStatus()
                future.addListener({
                    try {
                        val status = future.get()
                        describer.close()
                        promise.resolve(status)
                    } catch (e: Exception) {
                        describer.close()
                        promise.resolve(-1)
                    }
                }, executor)
            } catch (e: Exception) {
                promise.resolve(-1)
            }
        }
    }

    private fun prepareEngine(describer: ImageDescriber, promise: Promise) {
        android.util.Log.d("GeminiNano", "Preparing inference engine...")
        val future = describer.prepareInferenceEngine()
        future.addListener({
            try {
                future.get() // Safe: future is already complete inside listener
                android.util.Log.d("GeminiNano", "✅ Engine prepared successfully!")
                imageDescriber = describer
                promise.resolve(true)
            } catch (e: Exception) {
                android.util.Log.e("GeminiNano", "Engine preparation failed", e)
                promise.reject("PREPARE_ERROR", "Prepare failed: ${e.message}", e)
            }
        }, executor)
    }

    private fun downloadAndPrepare(describer: ImageDescriber, promise: Promise) {
        android.util.Log.d("GeminiNano", "Starting model download...")
        val future = describer.downloadFeature(object : DownloadCallback {
            override fun onDownloadStarted(bytesToDownload: Long) {
                android.util.Log.d("GeminiNano", "Download started: ${bytesToDownload / 1_000_000} MB")
            }
            override fun onDownloadProgress(totalBytesDownloaded: Long) {
                android.util.Log.d("GeminiNano", "Downloaded: ${totalBytesDownloaded / 1_000_000} MB")
            }
            override fun onDownloadCompleted() {
                android.util.Log.d("GeminiNano", "Download completed!")
            }
            override fun onDownloadFailed(e: GenAiException) {
                android.util.Log.e("GeminiNano", "Download failed", e)
            }
        })
        future.addListener({
            try {
                future.get()
                prepareEngine(describer, promise)
            } catch (e: Exception) {
                promise.reject("DOWNLOAD_ERROR", "Download failed: ${e.message}", e)
            }
        }, executor)
    }

    private fun base64ToBitmap(base64: String): Bitmap {
        val cleanBase64 = if (base64.contains(",")) {
            base64.substringAfter(",")
        } else {
            base64
        }
        val bytes = Base64.decode(cleanBase64, Base64.DEFAULT)
        return BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
            ?: throw Exception("Failed to decode image from base64")
    }
}
