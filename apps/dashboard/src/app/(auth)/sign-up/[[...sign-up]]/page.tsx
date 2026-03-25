import { redirect } from 'next/navigation';

export default function SignUpPage() {
  // Auth is handled at the API level; redirect to dashboard home
  redirect('/');
}
