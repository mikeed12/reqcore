import { destroyCabinetSession } from '../../../utils/cabinet-auth'

export default defineEventHandler(async (event) => {
  await destroyCabinetSession(event)
  return { ok: true }
})
