
# Splitpay Android

Splitpay is a UPI QR splitting app designed to help divide a total amount into multiple QR payments.

## Features

- Editable shop name
- Add multiple UPI IDs
- Generate UPI QR codes
- Split larger amounts into smaller QR amounts
- Share QR images as JPEG files
- Add customer names
- Save payment history in the browser
- Record UPI-paid and cash-paid QR statuses

## Build APK

1. Open the repository on GitHub.
2. Select the **Actions** tab.
3. Open **Build Splitpay Android APK**.
4. Wait for the workflow to finish successfully.
5. Open the completed workflow run.
6. Under **Artifacts**, download `Splitpay-APK`.
7. Extract the downloaded artifact ZIP to find `app-debug.apk`.

## Important Notes

- Payment status is entered manually. The app does not verify UPI payments automatically.
- QR image creation in the current web app requires an internet connection.
- Payment history is stored in the browser's local storage and may be lost if browser data is cleared.
- A debug APK is for testing and is not a signed release APK.
