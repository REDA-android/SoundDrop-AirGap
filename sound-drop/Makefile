.PHONY: all dsp daemon payload telemetry cli gui test clean

all: dsp daemon payload telemetry cli gui

dsp:
	@echo "==> Compiling C++20 AVX2 & Rust DSP Engine..."
	cd dsp-engine && cargo build --release

daemon:
	@echo "==> Compiling Go Airgap Mesh & Offline Edge Runtime..."
	cd daemon-mesh && go build -o bin/sounddrop_mesh ./cmd/daemon

payload:
	@echo "==> Verifying Python Payload Vault & Crypto Engine..."
	python sound-drop/payload-vault/packager.py

telemetry:
	@echo "==> Running R Empirical ToF & PSD Telemetry..."
	Rscript sound-drop/telemetry-lab/tof_analysis.R

cli:
	@echo "==> Testing Ruby Air-Gap CLI Ops..."
	ruby sound-drop/cli-ops/bin/sounddrop_ctl status

gui:
	@echo "==> Compiling Native GPU Slint Interface..."
	cd native-gui && cargo build --release

test:
	@echo "==> Running Complete Airgap Loopback Test..."
	python sound-drop/payload-vault/crypto_box.py
	python sound-drop/payload-vault/packager.py

clean:
	rm -rf target/ dsp-engine/target/ native-gui/target/ daemon-mesh/bin/
