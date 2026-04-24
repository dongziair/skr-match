# Solana Mobile dApp Store Compliance Notes

Reference policy: https://docs.solanamobile.com/dapp-store/publisher-policy

This project was updated against the Solana Mobile Publisher Policy sections for
restricted content, user data, restricted transactions, and user-generated
content.

## Implemented Changes

- Added an in-app **Privacy & Safety** center with privacy summary, support
  contact, local data clearing, and server profile deletion.
- Added wallet-signed deletion for `/api/player/:wallet` so profile deletion
  cannot be triggered by knowing only a public wallet address.
- Reduced `/api/players` output to leaderboard fields only.
- Added `/api/report` and in-app leaderboard report/hide actions for `.skr`
  display names.
- Added an explicit purchase confirmation screen before paid power-up
  transactions.
- Updated the transaction memo to truthfully describe the SKR Match purchase.
- Renamed the daily reward flow from "Daily Spin" to "Daily Bonus" and clarified
  that rewards are free in-game power-ups with no cash value.
- Disabled Android device backup for app data.
- Removed hard-coded Android release signing passwords from `build.gradle`.

## Submission Checklist

- Provide the privacy policy URL in the dApp Store listing.
- Provide a working support contact: `support@skr-match.app`.
- Describe paid power-ups as non-refundable in-game SKR token transfers, not
  financial products, investments, yield, cash rewards, or gambling.
- Use content rating 13+ unless a legal review supports a lower rating.
- Keep screenshots consistent with the current "Daily Bonus" and transaction
  confirmation UI.
- Provide Android signing credentials through environment variables or Gradle
  properties:
  - `SKR_MATCH_KEYSTORE_FILE`
  - `SKR_MATCH_KEYSTORE_PASSWORD`
  - `SKR_MATCH_KEY_ALIAS`
  - `SKR_MATCH_KEY_PASSWORD`
