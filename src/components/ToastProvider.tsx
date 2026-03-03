import React from 'react'
import { Toaster } from 'react-hot-toast'

export function ToastProvider() {
  return (
    <Toaster
      position="top-right"
      reverseOrder={false}
      gutter={8}
      toastOptions={{
        duration: 4000,
        style: {
          background: '#1f2937',
          color: '#f3f4f6',
          border: '1px solid #374151',
        },
      }}
    />
  )
}
