CREATE POLICY "temp_download_audios_presenciais_20260522"
ON storage.objects FOR SELECT
TO public
USING (
  bucket_id = 'audio-temp'
  AND name IN (
    '808647e5-1d3b-4e3a-8886-d835b1117e2c/1779476639022.webm',
    '808647e5-1d3b-4e3a-8886-d835b1117e2c/1778591162508.webm',
    '808647e5-1d3b-4e3a-8886-d835b1117e2c/1778527227656.webm',
    '808647e5-1d3b-4e3a-8886-d835b1117e2c/1778527213313.webm',
    '808647e5-1d3b-4e3a-8886-d835b1117e2c/1778526837462.webm',
    '808647e5-1d3b-4e3a-8886-d835b1117e2c/1778526823850.webm'
  )
);