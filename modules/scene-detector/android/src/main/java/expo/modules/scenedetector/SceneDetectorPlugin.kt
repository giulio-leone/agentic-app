package expo.modules.scenedetector

import android.media.Image
import com.mrousavy.camera.frameprocessors.Frame
import com.mrousavy.camera.frameprocessors.FrameProcessorPlugin
import com.mrousavy.camera.frameprocessors.VisionCameraProxy
import java.nio.ByteBuffer
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

class SceneDetectorPlugin(proxy: VisionCameraProxy, options: Map<String, Any>?) : FrameProcessorPlugin() {
    private val lastGrid = DoubleArray(256) { 0.0 }

    override fun callback(frame: Frame, arguments: Map<String, Any>?): Any {
        val image: Image = frame.image
        
        val planes = image.planes
        if (planes.isEmpty()) return mapOf("difference" to 0.0)
        
        val yPlane = planes[0]
        val buffer: ByteBuffer = yPlane.buffer
        val width = image.width
        val height = image.height
        val rowStride = yPlane.rowStride
        val pixelStride = yPlane.pixelStride

        val currentGrid = DoubleArray(256) { 0.0 }
        val countGrid = DoubleArray(256) { 0.0 }
        
        val cellWidth = max(width / 16, 1)
        val cellHeight = max(height / 16, 1)

        buffer.rewind()
        
        // Sample every 8th pixel for speed
        for (y in 0 until height step 8) {
            val cellY = min(y / cellHeight, 15)
            val rowOffset = y * rowStride
            for (x in 0 until width step 8) {
                val cellX = min(x / cellWidth, 15)
                val pixelOffset = rowOffset + (x * pixelStride)
                // Use bitwise AND to handle unsigned byte conversion properly
                val pixel = buffer.get(pixelOffset).toInt() and 0xFF
                
                val index = cellY * 16 + cellX
                currentGrid[index] += pixel.toDouble()
                countGrid[index] += 1.0
            }
        }
        
        var totalDiff = 0.0
        for (i in 0 until 256) {
            val count = max(countGrid[i], 1.0)
            val normalized = currentGrid[i] / count
            totalDiff += abs(normalized - lastGrid[i])
            lastGrid[i] = normalized
        }
        
        val averageDiff = totalDiff / 256.0
        
        // Log the difference every once in a while to avoid flooding
        if (Math.random() < 0.1) {
            android.util.Log.d("SceneDetector", "Calculated average diff: $averageDiff")
        }

        return mapOf("difference" to averageDiff)
    }
}
