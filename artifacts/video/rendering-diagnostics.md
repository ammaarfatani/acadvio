# Rendering diagnostics

The approved storyboard is unchanged. Rendering uses the existing real product captures, plus authorized Super Admin and missing Finance workflow captures.

Motion app `asdk_app_6ac0c144843481918a5cfef407ab0348` is recognized and inherits the allowed low-risk actions setting. No permission denial was returned. The installed plugin contains a manifest and app reference, with no local renderer or MCP implementation. The active callable tool inventory contains no Motion timeline, render-job, job-status, audio-synthesis or MP4-export tool. Public dependency lookup cannot resolve this private custom plugin; that lookup does not establish its remote connection state. The exact remote configuration failure cannot be diagnosed through the currently exposed management APIs.

To use Motion specifically, the custom plugin owner must expose its real video render/export tools to this Codex session, reconnect/reload the plugin, and confirm those tools appear. Broadening permissions alone does not add missing tools. This is no longer a blocker for the requested MP4: a local encoder is available.

Local export uses FFmpeg 7.1 from the PyPI `imageio-ffmpeg` wheel, Pillow from the bundled runtime, Segoe UI fonts, and Windows Microsoft David narration. These dependencies are stored under artifacts, without changing the CRM package dependencies. No screenshots or school data were uploaded to an external video service. `render_video.py` reads timings, captions and narration directly from the unchanged storyboard. Scene narration is delayed 350ms and fitted to each scene, with silence padded to its exact duration.

The local renderer adds white framing, red accents, restrained zoom/pan, cursor overlays and short wipes/dissolves. It uses original screenshots rather than generating replacement product interfaces. Export format is H.264 with AAC stereo audio in MP4. `verify_video.py` fully decodes the export, checks duration, resolution, frame rate, audio, scene timing and black frames, and extracts a final review sheet.
