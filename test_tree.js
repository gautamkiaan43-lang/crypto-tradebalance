const pool = require('./config/db');

async function run() {
    try {
        let globalLevel1 = [];
        const [level1] = await pool.execute("SELECT id FROM users WHERE sponsor_id IS NULL OR sponsor_id = '' OR sponsor_id = 'admin' OR sponsor_id = 'TB-00000' OR sponsor_id = 'SYSTEM'");
        globalLevel1 = level1;
        let currentLevelIds = level1.flatMap(u => [`TB-${u.id.toString().padStart(5, '0')}`, u.id.toString(), `TB-MEMBER-${u.id}`]);
        
        console.log('L1 Count:', globalLevel1.length);
        
        const levels = [];
        for (let i = 1; i <= 4; i++) {
            let referrals = [];

            if (i === 1) {
                referrals = globalLevel1;
            } else {
                if (currentLevelIds.length > 0) {
                    const placeholders = currentLevelIds.map(() => '?').join(',');
                    const [res] = await pool.execute(
                        `SELECT id FROM users WHERE sponsor_id IN (${placeholders})`,
                        currentLevelIds
                    );
                    referrals = res;
                }
            }

            levels.push({
                level: i,
                count: referrals.length
            });

            currentLevelIds = referrals.flatMap(u => [
                 `TB-${u.id.toString().padStart(5, '0')}`,
                 u.id.toString(),
                 `TB-MEMBER-${u.id}`
            ]);
        }
        
        console.log('Levels output:', levels);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
run();
