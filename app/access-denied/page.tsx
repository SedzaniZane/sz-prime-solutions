import Link from "next/link";
export default function AccessDenied() {
  return <main><h1>Staff access required</h1><p>Your account does not have active operations access. Contact the SZ Prime administrator.</p><Link href="/">Return to website</Link></main>;
}
