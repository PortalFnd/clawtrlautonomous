import { createWalletClient, createPublicClient, http, parseEther, formatEther, parseUnits, formatUnits, type Address, type Hash } from 'viem'
import { base, baseSepolia } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'

const USDC_BASE_MAINNET: Address = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
const USDC_BASE_SEPOLIA: Address = '0x036CbD53842c5426634e7929541eC2318f3dCF7e'
const USDC_DECIMALS = 6

const ERC20_ABI = [
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'transfer', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
  { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
  { name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'decimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint8' }] },
  { name: 'symbol', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'string' }] },
] as const

function getConfig() {
  const network = process.env.CLAWTRL_WALLET_NETWORK || process.env.AGENT_WALLET_NETWORK || 'base'
  const privateKey = process.env.CLAWTRL_WALLET_PRIVATE_KEY || process.env.AGENT_WALLET_PRIVATE_KEY
  const dailyCap = Number(process.env.CLAWTRL_WALLET_DAILY_CAP_USDC || process.env.WALLET_DAILY_CAP_USDC || '0')
  const address = process.env.CLAWTRL_WALLET_ADDRESS || undefined
  const rpcUrl = process.env.BASE_RPC_URL || (network === 'base-sepolia' ? 'https://sepolia.base.org' : 'https://mainnet.base.org')
  const chain = network === 'base-sepolia' ? baseSepolia : base
  const usdcAddress = network === 'base-sepolia' ? USDC_BASE_SEPOLIA : USDC_BASE_MAINNET
  return { network, privateKey, dailyCap, address, rpcUrl, chain, usdcAddress }
}

export function hasWalletCredentials() {
  return Boolean(getConfig().privateKey)
}

function getClients() {
  const { privateKey, rpcUrl, chain } = getConfig()
  if (!privateKey) throw new Error('Wallet private key not configured. Run wallet:init first.')
  const account = privateKeyToAccount(privateKey as `0x${string}`)
  const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) })
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) })
  return { walletClient, publicClient, account, address: account.address }
}

export async function getETHBalance(): Promise<string> {
  const { publicClient, address } = getClients()
  const bal = await publicClient.getBalance({ address })
  return formatEther(bal)
}

export async function getUSDCBalance(): Promise<string> {
  const { usdcAddress } = getConfig()
  if (!usdcAddress) throw new Error('USDC address not known for this network')
  const { publicClient, address } = getClients()
  const bal = await publicClient.readContract({ address: usdcAddress, abi: ERC20_ABI, functionName: 'balanceOf', args: [address] })
  return formatUnits(bal, USDC_DECIMALS)
}

export async function getTokenBalance(tokenAddress: string): Promise<{ balance: string; symbol: string; decimals: number }> {
  const { publicClient, address } = getClients()
  const [bal, sym, dec] = await Promise.all([
    publicClient.readContract({ address: tokenAddress as Address, abi: ERC20_ABI, functionName: 'balanceOf', args: [address] }),
    publicClient.readContract({ address: tokenAddress as Address, abi: ERC20_ABI, functionName: 'symbol' }),
    publicClient.readContract({ address: tokenAddress as Address, abi: ERC20_ABI, functionName: 'decimals' }),
  ])
  return { balance: formatUnits(bal, dec), symbol: sym, decimals: dec }
}

export async function getGasPrice(): Promise<{ price: string; estimateEthTransfer: string }> {
  const { publicClient } = getClients()
  const gasPrice = await publicClient.getGasPrice()
  const estimate = gasPrice * BigInt(21000)
  return { price: formatUnits(gasPrice, 9) + ' gwei', estimateEthTransfer: formatEther(estimate) }
}

export async function sendETH(to: string, amount: string): Promise<Hash> {
  const { walletClient } = getClients()
  const value = parseEther(amount)
  const hash = await walletClient.sendTransaction({ to: to as Address, value })
  return hash
}

export async function sendUSDC(to: string, amount: string): Promise<Hash> {
  const { usdcAddress } = getConfig()
  const { walletClient } = getClients()
  const value = parseUnits(amount, USDC_DECIMALS)
  const hash = await walletClient.writeContract({ address: usdcAddress as Address, abi: ERC20_ABI, functionName: 'transfer', args: [to as Address, value] })
  return hash
}

export async function approveToken(tokenAddress: string, spender: string, amount: string): Promise<Hash> {
  const { walletClient } = getClients()
  const { decimals } = await getTokenBalance(tokenAddress)
  const value = parseUnits(amount, decimals)
  const hash = await walletClient.writeContract({ address: tokenAddress as Address, abi: ERC20_ABI, functionName: 'approve', args: [spender as Address, value] })
  return hash
}

export async function checkDailyCap(amount: number): Promise<boolean> {
  const { dailyCap } = getConfig()
  if (!dailyCap || dailyCap <= 0) return true
  const { getTodaySpentUsd } = await import('./tx-log')
  const spent = getTodaySpentUsd()
  return (spent + amount) <= dailyCap
}

export async function getWalletInfo() {
  const { address, network } = getConfig()
  if (!address) throw new Error('Wallet address not configured')
  const [ethBal, usdcBal] = await Promise.all([
    getETHBalance().catch(() => '0'),
    getUSDCBalance().catch(() => '0'),
  ])
  return { address, network, ethBalance: ethBal, usdcBalance: usdcBal }
}

export async function waitForReceipt(hash: Hash) {
  const { publicClient } = getClients()
  return publicClient.waitForTransactionReceipt({ hash })
}

export { getConfig }
