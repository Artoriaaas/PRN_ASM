import { FirebaseError } from 'firebase/app'

const messages: Record<string, string> = {
  'auth/account-exists-with-different-credential':
    'Email này đã được đăng ký bằng phương thức khác.',
  'auth/email-already-in-use': 'Email này đã được sử dụng.',
  'auth/invalid-credential': 'Email hoặc mật khẩu không chính xác.',
  'auth/invalid-email': 'Địa chỉ email không hợp lệ.',
  'auth/missing-password': 'Vui lòng nhập mật khẩu.',
  'auth/network-request-failed': 'Không thể kết nối Firebase. Hãy kiểm tra mạng.',
  'auth/popup-closed-by-user': 'Cửa sổ đăng nhập Google đã bị đóng.',
  'auth/popup-blocked': 'Trình duyệt đã chặn cửa sổ đăng nhập Google.',
  'auth/too-many-requests': 'Thao tác quá nhiều lần. Vui lòng thử lại sau.',
  'auth/user-disabled': 'Tài khoản này đã bị khóa.',
  'auth/weak-password': 'Mật khẩu phải có ít nhất 6 ký tự.',
}

export function getAuthErrorMessage(error: unknown) {
  if (error instanceof FirebaseError) {
    return messages[error.code] ?? `Firebase báo lỗi: ${error.code}`
  }

  return error instanceof Error ? error.message : 'Đã xảy ra lỗi không xác định.'
}
