import { NextResponse } from 'next/server'
import { isWalletWriteProtected } from '../../../../lib/wallet-auth'

export async function GET() {
  return NextResponse.json({ protected: isWalletWriteProtected() })
}
