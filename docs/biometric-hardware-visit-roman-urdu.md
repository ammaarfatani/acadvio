# Acadivo biometric attendance: school visit guide (Roman Urdu)

## Pehle se pata honi chahiye

- Acadivo mein do integration contracts hain: **Direct JSON Push** aur **Local Connector / HTTP JSON Adapter**. Device ka brand/model form mein likhne se uska native protocol automatically support nahi hota.
- Is repo mein ZKTeco, Hikvision, Anviz ya kisi aur brand ka native SDK/protocol adapter implemented ya hardware-tested nahi hai. TCP socket polling, USB driver, fingerprint/face template transfer aur universal Wi-Fi discovery supported nahi hain.
- Machine ya uske vendor bridge ko documented event JSON dena hoga. Agar device aisa nahi kar sakti, to us model ka vendor SDK/protocol dekh kar alag adapter banana aur usi hardware par test karna hoga.
- School ke private LAN IP ko cloud server seedha access nahi kar sakta. Local connector school ke PC par chalega aur **outbound HTTPS** se Acadivo cloud ko data bhejega. Router par port-forwarding mat karo.

## Visit se pehle

1. Acadivo ka current HTTPS website/API URL aur School Admin login access ready rakho. Machine test karne ke liye browser/API publicly reachable hone chahiye.
2. Backend operator se confirm karao:
   - `BIOMETRIC_PROVISION_DIR` absolute, private, persistent folder par set hai; yeh `public` folder se bahar hona chahiye.
   - Is folder ko sirf backend service account aur authorized operator read kar sakte hain. Windows par folder ACL restrict hon. Provisioned `.env` file ko email/chat mein mat bhejo aur repo mein mat rakho.
   - `BIOMETRIC_ENCRYPTION_KEY` 64 hex characters ka configured ho **agar** LAN HTTP adapter ka username/password save karna ho.
   - MongoDB transactions enabled hon (cloud MongoDB replica set / supported cluster). App ke attendance transactions standalone MongoDB par fail ho sakte hain.
3. Connector host PC par Node.js 20 ya baad ka version ho. Admin ke Biometric Devices section se official connector aur installation guide download ki ja sakti hai. Extra vendor software/SDK tabhi install karo jab machine manufacturer us model ke liye zaroori bataye.
4. School se pehle hi pooch lo: brand, exact model, firmware, available protocol/API/SDK, machine admin access, device IP, documented port, timezone, aur kya event export/API available hai. Port guess mat karo.
5. Ek school-approved test employee choose karo aur uska Acadivo staff account pehle se bana ho. Acadivo ko fingerprint/face template nahi chahiye; sirf machine ka employee ID, punch ka waqt aur optional method (fingerprint/card) aata hai.
6. Production mein `BIOMETRIC` mode switch karne se manual check-in band ho sakta hai. School admin ki approval ke baghair mode change, real payroll calculation, ya broad staff enrollment mat karo. Behtar hai pehle isolated/staging school par connector contract verify ho.

## School par network check

1. Machine ke sticker/menu se brand/model note karo; device admin menu se IP aur timezone lo. Admin PIN ko recording, screenshot ya chat mein expose mat karo.
2. Connector chalne wale laptop ko usi school Wi-Fi/LAN par connect karo jahan machine reachable hai. Agar mumkin ho to LAN cable use karo. Internet bhi chahiye, kyun ke connector cloud ko outbound HTTPS request bhejta hai.
3. PowerShell mein `ipconfig` chala kar laptop ka IPv4 aur subnet dekho. Machine ka IP same reachable network par hona chahiye.
4. School ki permission ke saath PowerShell mein `ping <device-ip>` chalao. Ping blocked ho sakta hai, is liye ping fail akela incompatibility ka saboot nahi.
5. Manufacturer ke documented port ko hi check karo: `Test-NetConnection <device-ip> -Port <documented-port>`. `TcpTestSucceeded : True` network socket reachable batata hai; is se Acadivo protocol compatibility prove nahi hoti.
6. Agar device se event read karne ke liye vendor HTTP adapter chahiye, us adapter ka test URL laptop ke browser/curl se check karo. Output mein documented normalized JSON hona chahiye: `events` array, har event ka stable `eventId`, `biometricUserId`, aur timezone offset ke saath `timestamp`. API response ko school ki permission ke baghair public endpoint par expose mat karo.

## Acadivo mein pehla safe test

1. School Admin portal mein sahi school **aur branch** select karo. Attendance Settings / Biometric Devices khol kar pehle policy ka timezone, shift start/end, grace minutes aur weekly off verify karo.
2. Agar school ne is live test ko approve kiya hai to hi Manual se Biometric mode par switch karo aur confirmation save karo. Existing attendance history preserve hoti hai, lekin mode switch live staff behavior ko badalta hai.
3. **Add device** chuno. Brand/model ko sach ke mutabiq enter karo. Connection type sirf tab chuno jab vendor/bridge us exact format ko support kare:
   - **Direct JSON Push:** device ya vendor bridge ko HTTPS par Acadivo `/api/workforce/biometric/<device-id>/transactions` endpoint par Bearer token ke saath JSON POST karna hoga.
   - **Local Connector / HTTP JSON:** school PC connector local device/vendor adapter ke HTTP endpoint ko poll karta hai. Host, port aur path wahi dalo jo vendor ne document kiya; format `events` JSON hona chahiye.
4. Device save karke **Map employees** kholo. Machine ka asli biometric user ID ek existing, active employee record se map karo. ID unique honi chahiye. Unknown ID ka event delete nahi hota; woh review ke liye pending rehta hai.
5. **Provision connector credentials** par click karne se private backend folder mein one-time credential file banti hai. UI sirf filename dikhati hai; woh file khud laptop tak transfer nahi karti. Backend operator ko approved secure method se file school PC tak pahunchani hogi. File/token ko chat, screenshot, Git ya normal email mein mat bhejo.
6. School PC par connector chalao. Environment mein Acadivo HTTPS API URL, device ID, token aur zaroorat par private queue directory set hon. Token ko command history/screenshot mein na dikhana. Connector download ke saath wali guide follow karo. Connector status files private local folder mein rehti hain.
7. **Check connection** ya **Sync now** request bhejo. Direct push ke liye device/bridge ka authenticated heartbeat/event zaroori hai; Local Connector ke liye connector ko heartbeat aur configured adapter response dena hota hai. Sirf button dabane se device connected nahi hoti.
8. Admin UI mein status, Last sync, Pending queue, Last error aur Sync logs dekho. `Connected` ka matlab authenticated adapter traffic dekha gaya; iska matlab har employee ID mapped ya har punch attendance mein process ho gaya, yeh zaroori nahi. Raw punches mein Pending/Error dekho.
9. Test employee ko machine par pehla punch karwao. Connector/adaptor sync ke baad Raw punches aur Staff Attendance mein correct branch, local school date, employee aur check-in verify karo. Acadivo pehla distinct punch check-in samajhta hai.
10. Kuch waqt baad doosra punch karwao aur sync karo. System sab se pehla punch check-in aur sab se aakhri distinct punch check-out leta hai. Beech ke punches raw log mein rehte hain; woh alag breaks/shift events nahi bante. Check-out missing ho to attendance row mein checkout blank rehta hai.
11. Late result shift start + configured grace par depend karta hai. Payroll mein sirf attendance dikhne se salary pay nahi hoti; payroll separately calculate/approve/payment process hota hai. Visit ke dauran live payroll run karne se pehle school se approval lo.

## Waqt aur attendance ka matlab

- Event timestamp ISO date-time hona chahiye aur us mein `Z` ya `+05:00` jaise explicit offset hona chahiye. Ambiguous local time (misal `09:05` without timezone) reject hoga.
- Device profile ka timezone field, event ke ambiguous time ko automatically convert nahi karta. Vendor adapter ko actual machine timezone se sahi offset laga kar timestamp bhejna hoga. Machine clock bhi sahi set honi chahiye.
- Future event 5 minute se zyada future mein ho ya 2000 se pehle ho to validation reject karti hai. Old offline events sync ho sakte hain; unka date shift, attendance policy aur employment period ke mutabiq check hota hai.
- Late minutes/grace aur overnight shift rules existing school policy se calculate hote hain. Early checkout se `workingMinutes` kam hota hai; current model mein alag `earlyDepartureMinutes`/early-departure deduction field nahi hai. Isay separate payroll rule samajh kar claim na karein.
- Offline connector local queue ko restart ke baad rakhta hai aur network aane par retry karta hai. Stable `eventId` duplicates ko rokta hai. Raw punches saved reh sakte hain jab employee unmapped ho ya period lock/manual correction conflict ho.

## Common errors

- **Awaiting connection / NOT_CONNECTED:** connector/device se authenticated heartbeat/event abhi nahi aaya. Device ID, token provisioning, cloud URL, internet aur connector process check karo.
- **Device Offline:** recent successful device activity nahi hai. Laptop LAN, device IP/port, adapter service aur machine power check karo.
- **Cloud unreachable / upload retry:** school PC ka internet/DNS/proxy aur Acadivo HTTPS URL check karo. Queue folder ko delete mat karo; queued punches us mein ho sakte hain.
- **Device connection/adapter failed:** host, port, path, JSON shape, vendor adapter log aur LAN reachability check karo. Connector ka generic error details chhupata hai; private local status/log operator check kare.
- **Unmapped biometric user ID:** machine ID ko correct branch ke active employee se map karo, phir mapping save karke pending punches reprocess karo.
- **Invalid device authentication:** token/device ID mismatch ya token rotate hua hai. Naya credential securely provision karke connector environment update karo; token ko UI/log mein paste mat karo.
- **Timestamp validation error:** machine clock/timezone aur ISO offset check karo. Connector ko local time ka andaza lagane ke liye na kaho.
- **Mongo transaction/database failure:** deployment ka Mongo replica set health aur API server logs operator se check karwao. Production DB URL/password chat mein share mat karo.
- **Mode/mapping changed, period locked, manual attendance conflict:** event raw register mein review ke liye rehta hai. Record ko overwrite/delete mat karo; school admin se attendance correction/period policy ke mutabiq action lo.

## Test khatam karne ke baad

1. Connector ko normal service/task control se stop karo, pending queue 0 aur last sync confirm karo. Queue ko manually delete mat karo.
2. School admin ke saath verify karo ke sirf approved test staff ki expected attendance row bani. Agar test ko remove/correct karna ho to audited attendance correction flow use karo; raw biometric record ko delete mat karo.
3. Agar school test ke baad Manual mode par wapas jaana chahe, School Admin mode-change confirmation ke saath switch kar sakta hai. Existing history preserve hoti hai. Device ko disable kiya ja sakta hai; token rotate karne se purana connector token invalid ho jata hai.
4. Report mein brand/model/firmware, protocol document, IP/port (private channel mein), event shape, connector version, timestamps aur exact UI error likho. Password, token, biometric template ya admin PIN share mat karo.

## Aaj ki short checklist

- [ ] Device brand/model/firmware aur vendor protocol document
- [ ] Device admin access aur documented IP/port/timezone
- [ ] Internet plus same school LAN/Wi-Fi par Node.js 20+ wala laptop
- [ ] Acadivo HTTPS login, correct school/branch, authorized admin
- [ ] Private credential provisioning folder + restricted Windows ACLs
- [ ] Vendor-compatible HTTP JSON adapter ya Direct JSON Push implementation
- [ ] One approved active test employee aur exact device user ID mapping
- [ ] First punch = check-in; later punch = checkout; Staff Attendance/raw log verification
- [ ] Live payroll/mode switch ke liye school authorization
- [ ] No port forwarding; no fingerprint/face template export; no secrets in screenshots/chat

**Hardware compatibility verdict abhi:** device details/adapter ke baghair physical readiness certify nahi ki ja sakti. Acadivo ka JSON ingestion aur connector contract software-tested hai; specific school machine ke saath real connection test abhi pending hai.
