export const localizeErrorMessage = (message: string) => {
  const normalized = message.trim()

  if (!normalized) {
    return 'เกิดข้อผิดพลาดบางอย่าง'
  }

  const lower = normalized.toLowerCase()

  if (
    lower.includes('host authentication required') ||
    lower.includes('invalid login credentials')
  ) {
    return 'กรุณาเข้าสู่ระบบ Host ก่อน'
  }

  if (lower.includes('this user is not allowed to host sessions')) {
    return 'บัญชีนี้ยังไม่มีสิทธิ์เข้าใช้งาน Host'
  }

  if (
    lower.includes('supabase browser configuration is missing') ||
    lower.includes('supabase server configuration is missing') ||
    lower.includes('set supabase_url')
  ) {
    return 'ระบบยังไม่พร้อมใช้งาน'
  }

  if (lower.includes('unable to reach server') || lower.includes('request failed')) {
    return 'เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ'
  }

  if (lower.includes('unable to load host studio')) {
    return 'โหลดหน้า Host ไม่สำเร็จ'
  }

  if (lower.includes('unable to load session')) {
    return 'โหลดห้องไม่สำเร็จ'
  }

  if (lower.includes('unable to update')) {
    return 'อัปเดตข้อมูลไม่สำเร็จ'
  }

  if (lower.includes('unable to change fullscreen')) {
    return 'เปลี่ยนโหมดเต็มจอไม่สำเร็จ'
  }

  if (lower.includes('unable to launch')) {
    return 'เริ่มห้องไม่สำเร็จ'
  }

  if (lower.includes('upload failed') || lower.includes('invalid image payload')) {
    return 'อัปโหลดภาพไม่สำเร็จ'
  }

  if (lower.includes('unable to save quiz')) {
    return 'บันทึกควิซไม่สำเร็จ'
  }

  if (lower.includes('unable to delete quiz')) {
    return 'ลบควิซไม่สำเร็จ'
  }

  if (lower.includes('unable to join session')) {
    return 'เข้าห้องไม่สำเร็จ'
  }

  if (lower.includes('submit failed')) {
    return 'ส่งคำตอบไม่สำเร็จ'
  }

  if (lower.includes('session not found')) {
    return 'ไม่พบห้องนี้'
  }

  if (lower.includes('session has ended')) {
    return 'ห้องนี้จบแล้ว'
  }

  if (lower.includes('question is not open')) {
    return 'ข้อนี้ปิดรับคำตอบแล้ว'
  }

  if (lower.includes('participant not found')) {
    return 'ไม่พบผู้เล่นนี้'
  }

  if (lower.includes('question not found')) {
    return 'ไม่พบคำถามนี้'
  }

  if (lower.includes('duplicate submission')) {
    return 'ข้อนี้ส่งคำตอบไปแล้ว'
  }

  if (lower.includes('quiz set not found')) {
    return 'ไม่พบควิซนี้'
  }

  if (lower.includes('no active question to close')) {
    return 'ยังไม่มีข้อที่กำลังเล่นอยู่'
  }

  if (lower.includes('leaderboard is unavailable before a question closes')) {
    return 'ยังเปิดสรุปอันดับไม่ได้'
  }

  if (lower.includes('unknown action')) {
    return 'คำสั่งนี้ยังไม่รองรับ'
  }

  if (lower.includes('question ') && lower.includes('is missing a prompt')) {
    return 'กรุณาใส่คำถามให้ครบ'
  }

  if (lower.includes('question ') && lower.includes('must have exactly four choices')) {
    return 'แต่ละข้อจะต้องมีตัวเลือกครบ 4 ตัวเลือก'
  }

  if (lower.includes('question ') && lower.includes('has an invalid image url')) {
    return 'ลิงก์รูปของคำถามไม่ถูกต้อง'
  }

  if (lower.includes('session has already finished')) {
    return 'เกมนี้จบแล้ว'
  }

  return normalized
}

export const toLocalizedError = (error: unknown, fallback: string) => {
  if (error instanceof Error) {
    return localizeErrorMessage(error.message)
  }

  return fallback
}
