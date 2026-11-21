// Στα Windows: χωρίς παράθυρο κονσόλας στην έκδοση release.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

//! IoT Guardian ως εφαρμογή υπολογιστή (ο κοινός κώδικας είναι στο lib.rs).

fn main() {
    iot_guardian_lib::run();
}
