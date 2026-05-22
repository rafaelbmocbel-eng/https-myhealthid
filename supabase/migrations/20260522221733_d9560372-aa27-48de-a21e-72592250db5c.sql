CREATE POLICY "temp_download_lucas_audio_20260522"
ON storage.objects FOR SELECT
TO public
USING (
  bucket_id = 'audio-temp'
  AND name = '808647e5-1d3b-4e3a-8886-d835b1117e2c/1779476639022.webm'
);