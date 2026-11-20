// Στα Windows: χωρίς παράθυρο κονσόλας στην έκδοση release.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

//! IoT Guardian ως εφαρμογή υπολογιστή.
//! Το παιχνίδι είναι στατικό HTML/CSS/JS: το Tauri το ανοίγει σε παράθυρο του
//! συστήματος (WebView), χωρίς server και χωρίς internet. Η πρόοδος μένει
//! στον υπολογιστή (localStorage της εφαρμογής).

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("δεν άνοιξε το παράθυρο του IoT Guardian");
}
