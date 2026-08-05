import { useRouter } from 'expo-router';

import { ProfileForm } from '@/components/profile-form';
import { ScreenShell } from '@/components/screen-shell';
import { useAuth } from '@/context/auth';

export default function EditProfileScreen() {
  const { profile } = useAuth();
  const router = useRouter();

  return (
    <ScreenShell
      eyebrow="YOUR DETAILS"
      title="Edit profile"
      subtitle="This is how other members will know you when trading doses."
      edges={['bottom']}>
      <ProfileForm
        profile={profile}
        submitLabel="Save changes"
        onSaved={() => router.back()}
      />
    </ScreenShell>
  );
}
