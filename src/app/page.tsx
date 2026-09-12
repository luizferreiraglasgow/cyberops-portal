import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Navbar } from '@/components/Navbar'
import { PlatformDashboard } from '@/components/PlatformDashboard'

export default async function HomePage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  return (
    <>
      <Navbar />
      <PlatformDashboard />
    </>
  )
}
