import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Upload,
  Download,
  Image as ImageIcon,
  Wand2,
  Settings,
  Sparkles,
  Camera,
  Check,
} from "lucide-react";

export default function Index() {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [backgroundOption, setBackgroundOption] = useState("transparent");
  const [customColor, setCustomColor] = useState("#ffffff");
  const [sensitivity, setSensitivity] = useState(75);
  const [edgeBuffer, setEdgeBuffer] = useState(25);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileUpload = (file: File) => {
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setUploadedImage(result);
        setProcessedImage(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const processImage = async () => {
    console.log("processImage called!", {
      uploadedImage: !!uploadedImage,
      isProcessing,
    });

    if (!uploadedImage) {
      console.log("No uploaded image available");
      return;
    }

    setIsProcessing(true);
    console.log("Starting background removal...");

    try {
      // Create image element
      const img = new Image();
      img.crossOrigin = "anonymous";

      await new Promise((resolve, reject) => {
        img.onload = () => {
          console.log("Image onload event fired");
          resolve(true);
        };
        img.onerror = (error) => {
          console.error("Image load error:", error);
          reject(error);
        };
        img.src = uploadedImage;
        console.log(
          "Image src set to:",
          uploadedImage.substring(0, 50) + "...",
        );
      });

      console.log("Image loaded successfully:", img.width, "x", img.height);

      // Create canvas for processing
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;
      canvas.width = img.width;
      canvas.height = img.height;

      // Draw original image
      ctx.drawImage(img, 0, 0);

      // Get image data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Simple but effective background removal
      removeBackground(data, img.width, img.height);

      // Put processed data back
      ctx.putImageData(imageData, 0, 0);

      // Set result
      const resultDataUrl = canvas.toDataURL("image/png");
      setProcessedImage(resultDataUrl);
      console.log(
        "Background removal completed! Result URL length:",
        resultDataUrl.length,
      );
    } catch (error) {
      console.error("Error in processImage:", error);
      alert("Error processing image: " + error.message);
    } finally {
      setIsProcessing(false);
      console.log("Processing finished, isProcessing set to false");
    }
  };

  const removeBackground = (
    data: Uint8ClampedArray,
    width: number,
    height: number,
  ) => {
    console.log("Starting simple background removal...");

    // Step 1: Sample only from the very outer edge (1 pixel border)
    const edgeColors = [];

    // Top and bottom edges
    for (let x = 0; x < width; x++) {
      // Top edge
      const topIdx = x * 4;
      edgeColors.push({
        r: data[topIdx],
        g: data[topIdx + 1],
        b: data[topIdx + 2],
      });

      // Bottom edge
      const bottomIdx = ((height - 1) * width + x) * 4;
      edgeColors.push({
        r: data[bottomIdx],
        g: data[bottomIdx + 1],
        b: data[bottomIdx + 2],
      });
    }

    // Left and right edges
    for (let y = 1; y < height - 1; y++) {
      // Left edge
      const leftIdx = y * width * 4;
      edgeColors.push({
        r: data[leftIdx],
        g: data[leftIdx + 1],
        b: data[leftIdx + 2],
      });

      // Right edge
      const rightIdx = (y * width + width - 1) * 4;
      edgeColors.push({
        r: data[rightIdx],
        g: data[rightIdx + 1],
        b: data[rightIdx + 2],
      });
    }

    // Step 2: Find the most common edge color (quantized)
    const colorCounts = new Map();

    for (const color of edgeColors) {
      // Quantize colors to reduce noise
      const quantR = Math.floor(color.r / 32) * 32;
      const quantG = Math.floor(color.g / 32) * 32;
      const quantB = Math.floor(color.b / 32) * 32;
      const key = `${quantR}-${quantG}-${quantB}`;

      colorCounts.set(key, (colorCounts.get(key) || 0) + 1);
    }

    // Get the most common background color
    const sortedColors = Array.from(colorCounts.entries()).sort(
      (a, b) => b[1] - a[1],
    );

    if (sortedColors.length === 0) {
      console.log("No edge colors found");
      return;
    }

    const [dominantColorKey] = sortedColors[0];
    const [r, g, b] = dominantColorKey.split("-").map(Number);
    const dominantColor = { r, g, b };

    console.log(
      "Dominant background color:",
      dominantColor,
      "Count:",
      sortedColors[0][1],
    );

    // Step 3: More effective background removal with flood fill
    const baseThreshold = Math.max(30, sensitivity * 1.5); // Better threshold range
    const visited = new Set();
    let removedPixels = 0;

    // Flood fill function from edge pixels
    const floodFill = (startX, startY) => {
      const stack = [[startX, startY]];
      const startIdx = startY * width + startX;
      const startDataIdx = startIdx * 4;

      const startColor = {
        r: data[startDataIdx],
        g: data[startDataIdx + 1],
        b: data[startDataIdx + 2],
      };

      // Check if start pixel is similar to dominant background
      const startDistance = Math.sqrt(
        Math.pow(startColor.r - dominantColor.r, 2) +
          Math.pow(startColor.g - dominantColor.g, 2) +
          Math.pow(startColor.b - dominantColor.b, 2),
      );

      if (startDistance > baseThreshold) return;

      while (stack.length > 0) {
        const [x, y] = stack.pop();

        if (x < 0 || x >= width || y < 0 || y >= height) continue;

        const pixelIdx = y * width + x;
        if (visited.has(pixelIdx)) continue;

        const dataIdx = pixelIdx * 4;
        const currentColor = {
          r: data[dataIdx],
          g: data[dataIdx + 1],
          b: data[dataIdx + 2],
        };

        // Check color similarity to start color (for region consistency)
        const colorDistance = Math.sqrt(
          Math.pow(currentColor.r - startColor.r, 2) +
            Math.pow(currentColor.g - startColor.g, 2) +
            Math.pow(currentColor.b - startColor.b, 2),
        );

        // More lenient threshold for connected regions
        if (colorDistance > baseThreshold * 0.8) continue;

        visited.add(pixelIdx);
        removedPixels++;

        // Apply background removal
        if (backgroundOption === "transparent") {
          data[dataIdx + 3] = 0;
        } else if (backgroundOption === "white") {
          data[dataIdx] = 255;
          data[dataIdx + 1] = 255;
          data[dataIdx + 2] = 255;
          data[dataIdx + 3] = 255;
        } else if (backgroundOption === "black") {
          data[dataIdx] = 0;
          data[dataIdx + 1] = 0;
          data[dataIdx + 2] = 0;
          data[dataIdx + 3] = 255;
        } else if (backgroundOption === "custom") {
          const hex = customColor.replace("#", "");
          const red = parseInt(hex.substr(0, 2), 16);
          const green = parseInt(hex.substr(2, 2), 16);
          const blue = parseInt(hex.substr(4, 2), 16);
          data[dataIdx] = red;
          data[dataIdx + 1] = green;
          data[dataIdx + 2] = blue;
          data[dataIdx + 3] = 255;
        }

        // Add neighbors to stack (4-connected)
        stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
      }
    };

    // Start flood fill from all edge pixels that match background
    const edgeBufferPixels = Math.max(5, edgeBuffer);

    // Top and bottom edges
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < edgeBufferPixels; y++) {
        if (!visited.has(y * width + x)) {
          floodFill(x, y);
        }
        if (!visited.has((height - 1 - y) * width + x)) {
          floodFill(x, height - 1 - y);
        }
      }
    }

    // Left and right edges
    for (let y = edgeBufferPixels; y < height - edgeBufferPixels; y++) {
      for (let x = 0; x < edgeBufferPixels; x++) {
        if (!visited.has(y * width + x)) {
          floodFill(x, y);
        }
        if (!visited.has(y * width + (width - 1 - x))) {
          floodFill(width - 1 - x, y);
        }
      }
    }

    // Also do simple color-based removal for any remaining similar pixels
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pixelIdx = y * width + x;
        if (visited.has(pixelIdx)) continue;

        const dataIdx = pixelIdx * 4;
        const pixelColor = {
          r: data[dataIdx],
          g: data[dataIdx + 1],
          b: data[dataIdx + 2],
        };

        const colorDistance = Math.sqrt(
          Math.pow(pixelColor.r - dominantColor.r, 2) +
            Math.pow(pixelColor.g - dominantColor.g, 2) +
            Math.pow(pixelColor.b - dominantColor.b, 2),
        );

        const edgeDistance = Math.min(x, y, width - x - 1, height - y - 1);

        if (
          colorDistance < baseThreshold * 0.7 &&
          edgeDistance < edgeBufferPixels * 2
        ) {
          removedPixels++;

          // Apply background option
          if (backgroundOption === "transparent") {
            data[dataIdx + 3] = 0;
          } else if (backgroundOption === "white") {
            data[dataIdx] = 255;
            data[dataIdx + 1] = 255;
            data[dataIdx + 2] = 255;
            data[dataIdx + 3] = 255;
          } else if (backgroundOption === "black") {
            data[dataIdx] = 0;
            data[dataIdx + 1] = 0;
            data[dataIdx + 2] = 0;
            data[dataIdx + 3] = 255;
          } else if (backgroundOption === "custom") {
            const hex = customColor.replace("#", "");
            const red = parseInt(hex.substr(0, 2), 16);
            const green = parseInt(hex.substr(2, 2), 16);
            const blue = parseInt(hex.substr(4, 2), 16);
            data[dataIdx] = red;
            data[dataIdx + 1] = green;
            data[dataIdx + 2] = blue;
            data[dataIdx + 3] = 255;
          }
        }
      }
    }

    console.log(
      `Simple background removal completed! Removed ${removedPixels} pixels (${((removedPixels / (width * height)) * 100).toFixed(1)}%)`,
    );
  };

  const downloadImage = () => {
    if (!processedImage) return;

    const link = document.createElement("a");
    link.download = `background-removed-${backgroundOption}.png`;
    link.href = processedImage;
    link.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-accent/10 to-primary/5">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-tr from-primary via-gradient-via to-gradient-to rounded-xl flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-gradient-to bg-clip-text text-transparent">
                  RemoveBG Pro
                </h1>
                <p className="text-xs text-muted-foreground">
                  Simple Background Removal
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="secondary" className="hidden sm:inline-flex">
                <Camera className="w-3 h-3 mr-1" />
                Free Tool
              </Badge>
              <Button variant="outline" size="sm">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary via-gradient-via to-gradient-to bg-clip-text text-transparent">
              Remove Backgrounds
            </h2>
            <p className="text-xl text-muted-foreground mb-2">
              Simple and effective background removal tool
            </p>
            <div className="flex flex-wrap justify-center gap-2 text-sm text-muted-foreground">
              <Badge variant="outline" className="flex items-center gap-1">
                <Check className="w-3 h-3" />
                Easy to Use
              </Badge>
              <Badge variant="outline" className="flex items-center gap-1">
                <Check className="w-3 h-3" />
                Instant Results
              </Badge>
              <Badge variant="outline" className="flex items-center gap-1">
                <Check className="w-3 h-3" />
                Multiple Formats
              </Badge>
              <Badge variant="default" className="flex items-center gap-1">
                <Check className="w-3 h-3" />
                Ready to Use
              </Badge>
            </div>
          </div>

          <div className="max-w-4xl mx-auto">
            <Card className="border-2 border-dashed border-border">
              <CardContent className="p-6">
                {!uploadedImage ? (
                  /* Upload Area */
                  <div
                    className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-all duration-200 ${
                      dragActive
                        ? "border-primary bg-primary/5 scale-[1.02]"
                        : "border-muted-foreground/25 hover:border-primary/50 hover:bg-primary/5"
                    }`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                  >
                    <div className="flex flex-col items-center space-y-4">
                      <div className="w-16 h-16 bg-gradient-to-tr from-primary/20 to-gradient-to/20 rounded-2xl flex items-center justify-center">
                        <Upload className="w-8 h-8 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold mb-2">
                          Drop your image here
                        </h3>
                        <p className="text-muted-foreground mb-4">
                          or click to browse files
                        </p>
                        <Button
                          onClick={() => fileInputRef.current?.click()}
                          className="bg-gradient-to-r from-primary to-gradient-to hover:opacity-90"
                        >
                          <ImageIcon className="w-4 h-4 mr-2" />
                          Choose Image
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Supports PNG, JPG, WEBP up to 10MB
                      </p>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) =>
                        e.target.files?.[0] &&
                        handleFileUpload(e.target.files[0])
                      }
                      className="hidden"
                    />
                  </div>
                ) : (
                  /* Image Workspace */
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <h3 className="text-lg font-semibold">
                          Background Remover
                        </h3>
                        <Badge variant="secondary">
                          {processedImage ? "Processed" : "Original"}
                        </Badge>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setUploadedImage(null);
                          setProcessedImage(null);
                        }}
                      >
                        New Image
                      </Button>
                    </div>

                    {/* Manual Adjustment Controls */}
                    <div className="p-4 bg-secondary/50 rounded-lg mb-4">
                      <h4 className="font-medium mb-3">Adjustment Controls</h4>
                      <div className="space-y-4">
                        <div>
                          <Label className="text-sm font-medium mb-2 block">
                            Sensitivity: {sensitivity}%
                          </Label>
                          <input
                            type="range"
                            min="10"
                            max="100"
                            value={sensitivity}
                            onChange={(e) =>
                              setSensitivity(Number(e.target.value))
                            }
                            className="w-full"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Higher = removes more background (be careful!)
                          </p>
                        </div>

                        <div>
                          <Label className="text-sm font-medium mb-2 block">
                            Edge Buffer: {edgeBuffer}px
                          </Label>
                          <input
                            type="range"
                            min="5"
                            max="50"
                            value={edgeBuffer}
                            onChange={(e) =>
                              setEdgeBuffer(Number(e.target.value))
                            }
                            className="w-full"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Only removes background within this distance from
                            edges
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Background Options */}
                    <div className="p-4 bg-secondary/50 rounded-lg">
                      <h4 className="font-medium mb-3">Background Options</h4>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant={
                            backgroundOption === "transparent"
                              ? "default"
                              : "outline"
                          }
                          size="sm"
                          onClick={() => setBackgroundOption("transparent")}
                        >
                          Transparent
                        </Button>
                        <Button
                          variant={
                            backgroundOption === "white" ? "default" : "outline"
                          }
                          size="sm"
                          onClick={() => setBackgroundOption("white")}
                        >
                          White
                        </Button>
                        <Button
                          variant={
                            backgroundOption === "black" ? "default" : "outline"
                          }
                          size="sm"
                          onClick={() => setBackgroundOption("black")}
                        >
                          Black
                        </Button>
                        <Button
                          variant={
                            backgroundOption === "custom"
                              ? "default"
                              : "outline"
                          }
                          size="sm"
                          onClick={() => setBackgroundOption("custom")}
                        >
                          Custom
                        </Button>
                        {backgroundOption === "custom" && (
                          <input
                            type="color"
                            value={customColor}
                            onChange={(e) => setCustomColor(e.target.value)}
                            className="w-8 h-8 rounded border ml-2"
                          />
                        )}
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      {/* Original Image */}
                      <div>
                        <Label className="text-sm font-medium mb-2 block">
                          Original
                        </Label>
                        <div className="relative aspect-square bg-checkerboard rounded-xl overflow-hidden border">
                          <img
                            src={uploadedImage}
                            alt="Original"
                            className="w-full h-full object-contain"
                          />
                        </div>
                      </div>

                      {/* Processed Image */}
                      <div>
                        <Label className="text-sm font-medium mb-2 block">
                          {isProcessing ? "Processing..." : "Result"}
                        </Label>
                        <div className="relative aspect-square bg-checkerboard rounded-xl overflow-hidden border">
                          {isProcessing ? (
                            <div className="w-full h-full flex items-center justify-center">
                              <div className="flex flex-col items-center space-y-3">
                                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                                <p className="text-sm text-muted-foreground">
                                  Removing background...
                                </p>
                              </div>
                            </div>
                          ) : processedImage ? (
                            <img
                              src={processedImage}
                              alt="Processed"
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                              <div className="text-center">
                                <Wand2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">
                                  Click "Remove Background" to start
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3 justify-center">
                      <Button
                        onClick={() => {
                          console.log("Remove Background button clicked!");
                          processImage();
                        }}
                        disabled={isProcessing}
                        size="lg"
                        className="bg-gradient-to-r from-primary to-gradient-to hover:opacity-90 px-8"
                      >
                        <Wand2 className="w-5 h-5 mr-2" />
                        {isProcessing ? "Processing..." : "Remove Background"}
                      </Button>

                      {processedImage && (
                        <Button
                          variant="outline"
                          size="lg"
                          onClick={downloadImage}
                          className="px-8"
                        >
                          <Download className="w-5 h-5 mr-2" />
                          Download PNG
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
