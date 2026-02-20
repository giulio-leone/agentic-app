package expo.modules.geminano

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Base64
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions

class GeminiNanoModule : Module() {
    private val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)

    override fun definition() = ModuleDefinition {
        Name("GeminiNano")

        // ML Kit Text Recognition doesn't require downloading a model separately like Gemini Nano does,
        // it is bundled or downloaded seamlessly via Google Play Services. So we just resolve true.
        AsyncFunction("initialize") { promise: Promise ->
            try {
                promise.resolve(true)
            } catch (e: Exception) {
                promise.reject("INIT_ERROR", "Initialization failed: ${e.message}", e)
            }
        }

        AsyncFunction("describeImage") { base64: String, promise: Promise ->
            try {
                val bitmap = base64ToBitmap(base64)
                val image = InputImage.fromBitmap(bitmap, 0)

                recognizer.process(image)
                    .addOnSuccessListener { visionText ->
                        bitmap.recycle() // free up memory
                        // We return the raw text blocks extracted by ML Kit
                        promise.resolve(visionText.text)
                    }
                    .addOnFailureListener { e ->
                        bitmap.recycle()
                        promise.reject("DESCRIBE_ERROR", "Text recognition failed: ${e.message}", e)
                    }
            } catch (e: Exception) {
                promise.reject("DESCRIBE_ERROR", "Description failed: ${e.message}", e)
            }
        }

        // Feature is always available if the Play Services dependency works.
        // Returning 3 (AVAILABLE) to match the previous Gemini Nano JS logic.
        AsyncFunction("checkStatus") { promise: Promise ->
            promise.resolve(3)
        }
    }

    private fun base64ToBitmap(base64: String): Bitmap {
        val cleanBase64 = if (base64.contains(",")) {
            base64.substringAfter(",")
        } else {
            base64
        }
        val bytes = Base64.decode(cleanBase64, Base64.DEFAULT)
        var bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
            ?: throw Exception("Failed to decode image from base64")

        try {
            val inputStream = java.io.ByteArrayInputStream(bytes)
            val exif = android.media.ExifInterface(inputStream)
            val orientation = exif.getAttributeInt(
                android.media.ExifInterface.TAG_ORIENTATION,
                android.media.ExifInterface.ORIENTATION_NORMAL
            )

            val matrix = android.graphics.Matrix()
            when (orientation) {
                android.media.ExifInterface.ORIENTATION_ROTATE_90 -> matrix.postRotate(90f)
                android.media.ExifInterface.ORIENTATION_ROTATE_180 -> matrix.postRotate(180f)
                android.media.ExifInterface.ORIENTATION_ROTATE_270 -> matrix.postRotate(270f)
            }
            
            // Downscale to avoid slow ML Kit processing if image is too large (e.g. 12MP from Camera)
            val maxDim = 1920
            if (bitmap.width > maxDim || bitmap.height > maxDim) {
                val scale = maxDim.toFloat() / Math.max(bitmap.width, bitmap.height)
                matrix.postScale(scale, scale)
            }

            if (!matrix.isIdentity) {
                val processedBitmap = Bitmap.createBitmap(
                    bitmap, 0, 0,
                    bitmap.width, bitmap.height,
                    matrix, true
                )
                bitmap.recycle()
                return processedBitmap
            }
        } catch (e: Exception) {
            android.util.Log.e("GeminiNano", "Failed to process image matrix: ${e.message}", e)
        }

        return bitmap
    }
}
