import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Update old categories in tickets
  await prisma.ticket.updateMany({
    where: { category: 'Email' },
    data: { category: 'Email & Communication' },
  })
  
  await prisma.ticket.updateMany({
    where: { category: 'Access Issue' },
    data: { category: 'Access & Permissions' },
  })

  // Update skills in users
  const users = await prisma.user.findMany()
  for (const user of users) {
    if (user.skills && user.skills !== '[]') {
      try {
        const skillsArray = JSON.parse(user.skills)
        if (Array.isArray(skillsArray)) {
          const updatedSkills = skillsArray.map(skill => {
            if (skill === 'Email' || skill === 'Email Issue') return 'Email & Communication'
            if (skill === 'Access Issue') return 'Access & Permissions'
            return skill
          })
          await prisma.user.update({
            where: { id: user.id },
            data: { skills: JSON.stringify(updatedSkills) },
          })
        }
      } catch (e) {
        console.error('Failed to parse skills for user', user.id)
      }
    }
  }

  console.log('Migration complete')
}

main().catch(console.error).finally(() => prisma.$disconnect())
