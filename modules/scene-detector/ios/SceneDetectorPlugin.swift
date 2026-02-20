import VisionCamera
import CoreMedia
import CoreVideo

@objc(SceneDetectorPlugin)
public class SceneDetectorPlugin: FrameProcessorPlugin {
  private var lastGrid = [Double](repeating: 0, count: 256)

  public override init(proxy: VisionCameraProxyHolder, options: [AnyHashable: Any]! = [:]) {
    super.init(proxy: proxy, options: options)
  }

  public override func callback(_ frame: Frame, withArguments arguments: [AnyHashable: Any]?) -> Any? {
    guard let buffer = frame.buffer else {
        return ["difference": 0.0]
    }
    
    CVPixelBufferLockBaseAddress(buffer, .readOnly)
    defer { CVPixelBufferUnlockBaseAddress(buffer, .readOnly) }

    // Typically the first plane of a bi-planar buffer is the Y (luminance) plane.
    guard CVPixelBufferGetPlaneCount(buffer) > 0 else {
      return ["difference": 0.0]
    }
    
    let lumaBaseAddress = CVPixelBufferGetBaseAddressOfPlane(buffer, 0)
    let width = CVPixelBufferGetWidthOfPlane(buffer, 0)
    let height = CVPixelBufferGetHeightOfPlane(buffer, 0)
    let bytesPerRow = CVPixelBufferGetBytesPerRowOfPlane(buffer, 0)
    
    var currentGrid = [Double](repeating: 0, count: 256)
    var countGrid = [Double](repeating: 0, count: 256)
    
    let cellWidth = max(width / 16, 1)
    let cellHeight = max(height / 16, 1)

    // Calculate sum of luma for each of the 16x16 cells
    if let baseAddress = lumaBaseAddress {
      let ptr = baseAddress.assumingMemoryBound(to: UInt8.self)
      // Sample every 8th pixel for speed
      for y in stride(from: 0, to: height, by: 8) { 
        let cellY = min(y / cellHeight, 15)
        for x in stride(from: 0, to: width, by: 8) {
          let cellX = min(x / cellWidth, 15)
          let pixel = ptr[y * bytesPerRow + x]
          let index = cellY * 16 + cellX
          currentGrid[index] += Double(pixel)
          countGrid[index] += 1
        }
      }
    }
    
    var totalDiff: Double = 0
    for i in 0..<256 {
       let count = max(countGrid[i], 1.0)
       let normalized = currentGrid[i] / count
       totalDiff += abs(normalized - lastGrid[i])
       lastGrid[i] = normalized
    }
    
    let averageDiff = totalDiff / 256.0
    return ["difference": averageDiff]
  }
}
