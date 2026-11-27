import { redirect } from 'next/navigation';

export default function CapsterLoginPage() {
  redirect('/login?role=capster');
}
