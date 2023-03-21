import { Html, Head, Main, NextScript } from 'next/document'
import React from 'react'
import '../styles/globals.css';

export default function Document() {
  return (
    <Html lang="en">
      <Head />
      <body className='content-center object-center'>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
