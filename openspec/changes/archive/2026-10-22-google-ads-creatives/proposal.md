## Why

The creative preview works for Meta ads only. A project connected to Google Ads shows its
campaigns and figures, but opening an ad says there is nothing to show, so a buyer must go back
to the Google Ads interface to see what the audience saw.

## What Changes

- Opening the preview of an ad imported from Google Ads reads its creative from Google Ads the
  first time, copies it into the system's storage and keeps it, as for Meta.
- Google creatives are shown as what Google describes: the images of image, display and Demand
  Gen ads, the YouTube videos of video ads with their thumbnails and a link to watch them on
  YouTube, and the headlines and descriptions of search and text ads.
- A creative can now be text: an ad of a kind with only words, such as a responsive search ad,
  carries one text creative with its headlines and descriptions.
- A creative may carry a link to where it can be watched, used for YouTube videos.
- The preview does not offer Meta's rendered preview for a Google ad.
- Google does not offer an API for rendering an ad as the audience sees it, and the creatives
  of Performance Max campaigns, which have no ads of their own, are not read.

## Capabilities

### New Capabilities

### Modified Capabilities
- `ad-creatives`: Google Ads creatives, text creatives and the watch link.

## Impact

- `apps/api`: the creative kind gains TEXT and a creative gains a source link; the Google Ads
  provider reads ads and their assets; the creative use case reads from Google as well as Meta.
- `apps/web`: the preview dialog shows text creatives and YouTube videos.
