# Supabase media storage setup

The app uses Supabase Storage for images, audio, and profile photos. Firebase Auth and Firestore remain unchanged.

## Environment variables

Add these Expo public variables to the web and native build environments:

- `EXPO_PUBLIC_SUPABASE_URL`: Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`: Supabase publishable/anon key
- `EXPO_PUBLIC_SUPABASE_STORAGE_BUCKET`: optional; defaults to `private-world-media`

Never use a Supabase service-role key in the app.

## Create the free bucket

In Supabase Dashboard, open **Storage**, create a bucket named `private-world-media`, and mark it **Public**.

Run this in the Supabase SQL Editor to allow the app to upload objects with the public anon key:

```sql
create policy "private world media uploads"
on storage.objects for insert
to anon, authenticated
with check (bucket_id = 'private-world-media');
```

A public bucket provides read access through its public URLs. The app stores those URLs in Firestore.

## Important limitation

Because the app authenticates users with Firebase rather than Supabase Auth, Supabase Storage policies cannot validate the Firebase user identity. The insert policy above allows uploads from clients that have the anon key. Keep the bucket limited to this app and monitor Supabase usage; moving uploads behind the existing authenticated Replit server would provide stronger abuse protection later.
