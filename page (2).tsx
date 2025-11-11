"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

export default function VideoOverlay() {
  const videoFileRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cameraVideoRef = useRef<HTMLVideoElement>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const animationFrameRef = useRef<number | null>(null)

  // ウェブカメラを起動
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
      })
      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = stream
        setCameraActive(true)
      }
    } catch (error) {
      console.error("カメラへのアクセスに失敗しました:", error)
      alert("カメラへのアクセスが許可されていません")
    }
  }

  // ウェブカメラを停止
  const stopCamera = () => {
    if (cameraVideoRef.current && cameraVideoRef.current.srcObject) {
      const tracks = (cameraVideoRef.current.srcObject as MediaStream).getTracks()
      tracks.forEach((track) => track.stop())
      setCameraActive(false)
    }
  }

  // オーバーレイ処理を開始
  const startOverlay = () => {
    if (!videoFileRef.current || !cameraVideoRef.current || !canvasRef.current) {
      alert("映像ファイルとカメラの両方が必要です")
      return
    }
    setIsRunning(true)
    processFrame()
  }

  // オーバーレイ処理を停止
  const stopOverlay = () => {
    setIsRunning(false)
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
  }

  // フレーム処理（クロマキー + オーバーレイ）
  const processFrame = () => {
    const canvas = canvasRef.current
    const videoFile = videoFileRef.current
    const cameraVideo = cameraVideoRef.current

    if (!canvas || !videoFile || !cameraVideo) return

    const ctx = canvas.getContext("2d", { willReadFrequently: true })
    if (!ctx) return

    // キャンバスサイズを設定
    canvas.width = videoFile.videoWidth
    canvas.height = videoFile.videoHeight

    // 背景映像（ファイル）を描画
    ctx.drawImage(videoFile, 0, 0, canvas.width, canvas.height)

    // 背景映像のピクセルデータを取得
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imageData.data

    // カメラ映像を一時的なキャンバスに描画（左右反転）
    const tempCanvas = document.createElement("canvas")
    tempCanvas.width = canvas.width
    tempCanvas.height = canvas.height
    const tempCtx = tempCanvas.getContext("2d")
    if (!tempCtx) return

    const cameraAspect = cameraVideo.videoWidth / cameraVideo.videoHeight
    const canvasAspect = canvas.width / canvas.height

    let drawWidth = canvas.width
    let drawHeight = canvas.height
    let offsetX = 0
    let offsetY = 0

    // アスペクト比に基づいて描画サイズを調整
    if (cameraAspect > canvasAspect) {
      drawHeight = canvas.width / cameraAspect
      offsetY = (canvas.height - drawHeight) / 2
    } else {
      drawWidth = canvas.height * cameraAspect
      offsetX = (canvas.width - drawWidth) / 2
    }

    // 左右反転を適用
    tempCtx.save()
    tempCtx.translate(canvas.width, 0)
    tempCtx.scale(-1, 1)
    tempCtx.drawImage(cameraVideo, offsetX, offsetY, drawWidth, drawHeight)
    tempCtx.restore()

    const cameraImageData = tempCtx.getImageData(0, 0, canvas.width, canvas.height)
    const cameraData = cameraImageData.data

    const greenThreshold = 100
    const centerX = canvas.width / 2
    const centerY = canvas.height / 2

    for (let i = 0; i < data.length; i += 4) {
      const pixelIndex = i / 4
      const x = pixelIndex % canvas.width
      const y = Math.floor(pixelIndex / canvas.width)

      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]

      // 緑色判定：G が R と B より大きい
      if (g > r + greenThreshold && g > b + greenThreshold) {
        // カメラ映像で置き換え
        data[i] = cameraData[i]
        data[i + 1] = cameraData[i + 1]
        data[i + 2] = cameraData[i + 2]
        data[i + 3] = cameraData[i + 3]
      }
    }

    ctx.putImageData(imageData, 0, 0)

    if (isRunning) {
      animationFrameRef.current = requestAnimationFrame(processFrame)
    }
  }

  useEffect(() => {
    if (isRunning) {
      processFrame()
    }
  }, [isRunning])

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-2">リアルタイムビデオオーバーレイ</h1>
        <p className="text-slate-300 mb-8">緑色部分にウェブカメラの映像をリアルタイムでオーバーレイします</p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 左側：入力映像 */}
          <div className="space-y-4">
            <Card className="p-6 bg-slate-800 border-slate-700">
              <h2 className="text-xl font-semibold text-white mb-4">背景映像（ファイル）</h2>
              <video
                ref={videoFileRef}
                controls
                className="w-full rounded-lg bg-black"
                style={{ maxHeight: "400px" }}
              />
              <div className="mt-4">
                <label className="block text-sm font-medium text-slate-300 mb-2">映像ファイルを選択</label>
                <input
                  type="file"
                  accept="video/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file && videoFileRef.current) {
                      const url = URL.createObjectURL(file)
                      videoFileRef.current.src = url
                    }
                  }}
                  className="block w-full text-sm text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700"
                />
              </div>
            </Card>

            <Card className="p-6 bg-slate-800 border-slate-700">
              <h2 className="text-xl font-semibold text-white mb-4">ウェブカメラ</h2>
              <video
                ref={cameraVideoRef}
                autoPlay
                playsInline
                className="w-full rounded-lg bg-black"
                style={{ maxHeight: "400px" }}
              />
              <div className="mt-4 flex gap-2">
                <Button
                  onClick={startCamera}
                  disabled={cameraActive}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                >
                  カメラ起動
                </Button>
                <Button
                  onClick={stopCamera}
                  disabled={!cameraActive}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                >
                  カメラ停止
                </Button>
              </div>
            </Card>
          </div>

          {/* 右側：出力映像 */}
          <div className="space-y-4">
            <Card className="p-6 bg-slate-800 border-slate-700">
              <h2 className="text-xl font-semibold text-white mb-4">オーバーレイ結果</h2>
              <canvas ref={canvasRef} className="w-full rounded-lg bg-black" style={{ maxHeight: "400px" }} />
              <div className="mt-4 flex gap-2">
                <Button
                  onClick={startOverlay}
                  disabled={isRunning || !cameraActive}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  オーバーレイ開始
                </Button>
                <Button
                  onClick={stopOverlay}
                  disabled={!isRunning}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                >
                  オーバーレイ停止
                </Button>
              </div>
            </Card>

            <Card className="p-6 bg-slate-800 border-slate-700">
              <h3 className="text-lg font-semibold text-white mb-3">使い方</h3>
              <ol className="text-slate-300 space-y-2 text-sm">
                <li>1. 映像ファイルを選択（緑色部分を含む）</li>
                <li>2. 「カメラ起動」をクリック</li>
                <li>3. 「オーバーレイ開始」をクリック</li>
                <li>4. 緑色部分がカメラ映像に置き換わります</li>
              </ol>
            </Card>
          </div>
        </div>
      </div>
    </main>
  )
}
