import { QRCodeSVG } from 'qrcode.react'

interface QRCodeDisplayProps {
  pin: string
  joinUrl?: string
  size?: number
}

export function QRCodeDisplay({ pin, joinUrl, size = 200 }: QRCodeDisplayProps) {
  const url = joinUrl || `${window.location.origin}/join`

  return (
    <div className="flex flex-col items-center gap-4 bg-white rounded-2xl p-6 shadow-xl">
      <QRCodeSVG
        value={url}
        size={size}
        bgColor="#ffffff"
        fgColor="#000000"
        level="M"
        imageSettings={{
          src: '',
          height: 0,
          width: 0,
          excavate: false,
        }}
      />
      <div className="text-center text-black">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Game PIN</div>
        <div className="text-4xl font-display font-black tracking-widest text-unoh-red" style={{ letterSpacing: '0.2em' }}>
          {pin}
        </div>
        <div className="mt-2 text-xs text-gray-400">Scan to Join</div>
        <div className="text-xs text-gray-600 font-mono mt-1">{url}</div>
      </div>
    </div>
  )
}
