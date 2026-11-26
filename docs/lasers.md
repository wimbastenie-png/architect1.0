# Bluetooth-lasers

De app koppelt een laserafstandsmeter via **Web Bluetooth**. Dat werkt in **Chrome op Android** en in Chrome op een pc of Mac met Bluetooth. Elke meting komt in het maatveld dat op dat moment actief is (in mm).

| Merk | Toestellen | In de app | Hoe |
| --- | --- | --- | --- |
| Leica DISTO | D110, D1, D2, D510, D810, X3, X4, S910 (Bluetooth Smart) | Ja | Publiek beschreven dienst; de meting is een getal in meter |
| Bosch | GLM 50 C, GLM 100 C, GLM 120 C, PLR 30/40/50 C | Ja | Protocol zoals beschreven door open-source projecten; de app zet "autosync" aan, waarna elke meting doorkomt |
| Hilti | PD-C, PD-CS, PD-E | Nee | Protocol niet publiek; zie hieronder |
| Stabila, Makita, DeWalt … | – | Nee | Eigen protocol, niet publiek beschreven |

**Niet getest met een echt toestel.** Controleer de eerste metingen met een rolmeter. Een firmware-update van de fabrikant kan het protocol veranderen.

## iPhone en iPad

Safari ondersteunt geen Web Bluetooth. Mogelijke uitweg: de browser **Bluefy** (App Store) ondersteunt Web Bluetooth (niet getest). De echte oplossing is de eigen iOS-app uit fase 6.

## Wat een eigen (native) app nodig heeft voor Hilti en andere merken

1. **Het protocol**: een beschrijving van de fabrikant (ontwikkelaarspakket, SDK) of de toestemming om het te gebruiken. Zonder die toestemming bouwen we het niet na.
2. **Een eigen app** voor iOS (Swift, Core Bluetooth) en Android (Kotlin, Android BLE): de browser kan geen toestellen koppelen die zich niet als standaard Bluetooth LE-dienst aanbieden, of die eerst een koppeling met pincode of een eigen versleuteling vragen.
3. **Een Apple-ontwikkelaarsaccount** (€ 99/jaar) en een **Google Play-account** (eenmalig $ 25), op naam van jouw firma.
4. **Een toestel om te testen** per merk en model.

Tot dan: lees de maat af op de laser en typ ze in.
