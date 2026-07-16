import sys
import subprocess

def free_port(port):
    try:
        # Run netstat to find process using the port
        cmd = f"netstat -aon"
        output = subprocess.check_output(cmd, shell=True).decode('utf-8', errors='ignore')
        pids = set()
        for line in output.strip().split('\n'):
            parts = line.split()
            if len(parts) >= 5:
                address = parts[1]
                pid = parts[-1]
                # Check if it matches :port
                if address.endswith(f":{port}") or address.endswith(f"[::]:{port}"):
                    pids.add(pid)
        for pid in pids:
            if pid != '0':
                print(f"[INFO] Liberando puerto {port} (Matando proceso PID {pid})...")
                subprocess.run(f"taskkill /F /PID {pid}", shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception as e:
        pass

if __name__ == "__main__":
    if len(sys.argv) > 1:
        port = sys.argv[1]
        free_port(port)
