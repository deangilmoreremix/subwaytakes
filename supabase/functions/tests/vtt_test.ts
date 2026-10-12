import {
  parseSrtToSegments,
  parseVttToSegments,
  segmentsToCaptions,
  type CaptionSegment,
} from "../_shared/vtt.ts";

function assertEquals<T>(actual: T, expected: T, message?: string): void {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) {
    throw new Error(
      `${message ?? "assertEquals failed"}\n  expected: ${b}\n  actual:   ${a}`,
    );
  }
}

function assertTrue(value: boolean, message?: string): void {
  if (!value) {
    throw new Error(`assertTrue failed: ${message}`);
  }
}

Deno.test("parseVttToSegments: basic WEBVTT document with index and header", () => {
  const vtt = `WEBVTT

1
00:00:01.000 --> 00:00:02.500
Hello world
`;

  assertEquals(parseVttToSegments(vtt), [
    { startSec: 1, endSec: 2.5, text: "Hello world" },
  ]);
});

Deno.test("parseVttToSegments: multi-line cues are joined and cue settings ignored", () => {
  const vtt = `WEBVTT

intro
00:00:00.000 --> 00:00:04.000 line:0
This is the first line
and the   second   line
`;

  assertEquals(parseVttToSegments(vtt), [
    { startSec: 0, endSec: 4, text: "This is the first line and the second line" },
  ]);
});

Deno.test("parseVttToSegments: gaps between cues are preserved", () => {
  const vtt = `WEBVTT

00:00:01.000 --> 00:00:02.000
One

00:00:05.000 --> 00:00:06.000
Two
`;

  const segments = parseVttToSegments(vtt);
  assertEquals(segments.length, 2);
  assertEquals(segments[0].endSec, 2);
  assertEquals(segments[1].startSec, 5);
});

Deno.test("parseVttToSegments: overlapping cues are preserved in order", () => {
  const vtt = `WEBVTT

00:00:01.000 --> 00:00:05.000
Long cue

00:00:02.000 --> 00:00:03.000
Short cue inside
`;

  assertEquals(parseVttToSegments(vtt), [
    { startSec: 1, endSec: 5, text: "Long cue" },
    { startSec: 2, endSec: 3, text: "Short cue inside" },
  ]);
});

Deno.test("parseVttToSegments: malformed blocks are skipped", () => {
  const vtt = `WEBVTT

NOTE this comment --> is not a cue

00:00:01.000 --> 00:00:02.000
Valid cue

this block has no timing line at all

00:00:03.000 -->
broken end timestamp

00:00:04.000 --> 00:00:03.000
end before start

00:00:05.000 --> 00:00:06.000

`;

  assertEquals(parseVttToSegments(vtt), [
    { startSec: 1, endSec: 2, text: "Valid cue" },
  ]);
});

Deno.test("parseVttToSegments: empty input yields no segments", () => {
  assertEquals(parseVttToSegments(""), []);
  assertEquals(parseVttToSegments("   \n\n  "), []);
});

Deno.test("parseVttToSegments: MM:SS.mmm shorthand is supported", () => {
  const vtt = `WEBVTT

00:01.500 --> 00:02.500
Short form
`;

  assertEquals(parseVttToSegments(vtt), [
    { startSec: 1.5, endSec: 2.5, text: "Short form" },
  ]);
});

Deno.test("parseSrtToSegments: comma decimals, numeric indexes and CRLF", () => {
  const srt = "1\r\n00:00:01,500 --> 00:00:03,000\r\nFirst subtitle\r\n\r\n2\r\n00:00:04,000 --> 00:00:05,250\r\nSecond subtitle\r\n";

  assertEquals(parseSrtToSegments(srt), [
    { startSec: 1.5, endSec: 3, text: "First subtitle" },
    { startSec: 4, endSec: 5.25, text: "Second subtitle" },
  ]);
});

Deno.test("parseSrtToSegments: malformed SRT blocks are skipped", () => {
  const srt = `1
00:00:01,000 --> 00:00:02,000
Keep me

2
not a timing line
Drop me

3
00:00:05,000 --> 00:00:04,000
Backwards
`;

  assertEquals(parseSrtToSegments(srt), [
    { startSec: 1, endSec: 2, text: "Keep me" },
  ]);
});

Deno.test("segmentsToCaptions: maps to StudioCaption shape and drops empty text", () => {
  const segments: CaptionSegment[] = [
    { startSec: 1, endSec: 2, text: "A" },
    { startSec: 3, endSec: 4, text: "   " },
    { startSec: 5, endSec: 6, text: "B" },
  ];

  assertEquals(segmentsToCaptions(segments, "cap"), [
    { id: "cap-1", text: "A", start: 1, end: 2, kind: "dialogue" },
    { id: "cap-3", text: "B", start: 5, end: 6, kind: "dialogue" },
  ]);
});

Deno.test("segmentsToCaptions: default id prefix", () => {
  const captions = segmentsToCaptions([{ startSec: 0, endSec: 1, text: "Hi" }]);
  assertEquals(captions.length, 1);
  assertEquals(captions[0].id, "cap-1");
  assertEquals(captions[0].kind, "dialogue");
});

Deno.test("parse + segmentsToCaptions round trip on a realistic VTT", () => {
  const vtt = `WEBVTT

00:00:00.500 --> 00:00:02.000
Yo, what's your hottest take?

00:00:02.500 --> 00:00:06.750
Honestly? Most people
are wrong about it.

00:00:07.000 --> 00:00:09.000
Wild.
`;

  const captions = segmentsToCaptions(parseVttToSegments(vtt), "job-42");
  assertEquals(captions.length, 3);
  assertEquals(captions[0].id, "job-42-1");
  assertEquals(captions[0].text, "Yo, what's your hottest take?");
  assertEquals(captions[1].text, "Honestly? Most people are wrong about it.");
  assertEquals(captions[2].start, 7);
  assertTrue(captions[2].end > captions[2].start, "caption end must be after start");
});
